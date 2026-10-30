import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { Night } from '../src/digest/types.js';

const base = { adapter: 'shim', installed: '2026-10-29T14:06:00+01:00', beatEverySeconds: 60 };
let tmp = '';
let app: ReturnType<typeof createApp>;

const line = (o: Record<string, unknown>) => JSON.stringify(o);
const T = '2026-10-28T02:00:00+01:00';

beforeAll(() => {
  process.env.LANE_MARKER = 'TEST-MARKER';
  tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
  const good = [
    line({ at: T, job: 'zeta', status: 'ok', owner: 'sam' }),
    line({ at: T, job: 'alpha', status: 'retry', owner: null }),
    line({ at: T, job: 'alpha', status: 'retry', owner: null }),
    line({ at: T, job: 'alpha', status: 'retry', owner: null }),
    line({ at: T, job: 'alpha', status: 'ok', owner: null }),
    line({ at: T, job: 'mid', status: 'fail', owner: 'kim', error: 'boom' }),
    line({ at: T, job: 'quiet', status: 'ok', owner: 'lee' }),
  ];
  writeFileSync(join(tmp, '2026-10-28.jsonl'), good.join('\n') + '\n');
  writeFileSync(join(tmp, '2026-10-27.jsonl'), '');
  writeFileSync(join(tmp, '2026-10-26.jsonl'), [good[0], 'not json {', good[5]].join('\n') + '\n');
  app = createApp({ ...base, runsDir: tmp });
});

afterAll(() => {
  rmSync(tmp, { recursive: true, force: true });
});

const rowFor = (html: string, job: string): string => {
  const m = html.match(new RegExp(`<tr[^>]*>(?:(?!</tr>)[\\s\\S])*?>${job}<(?:(?!</tr>)[\\s\\S])*</tr>`));
  return m ? m[0] : '';
};

describe('GET /digest/:night', () => {
  it('renders every job in a table, sorted by job, with the lane banner', async () => {
    const res = await app.request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('TEST-MARKER');
    expect(html).toContain('<table');
    const pos = ['alpha', 'mid', 'quiet', 'zeta'].map((j) => html.indexOf(`>${j}<`));
    expect(pos.every((p) => p >= 0)).toBe(true);
    expect([...pos].sort((a, b) => a - b)).toEqual(pos);
  });

  it('marks retries >= 3 and failed jobs with class warn, not the others', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(rowFor(html, 'alpha')).toMatch(/class="[^"]*\bwarn\b/);
    expect(rowFor(html, 'mid')).toMatch(/class="[^"]*\bwarn\b/);
    expect(rowFor(html, 'quiet')).not.toMatch(/\bwarn\b/);
    expect(rowFor(html, 'zeta')).not.toMatch(/\bwarn\b/);
  });

  it('shows a null owner as an em dash', async () => {
    const html = await (await app.request('/digest/2026-10-28')).text();
    expect(rowFor(html, 'alpha')).toContain('—');
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/digest/2026-01-01')).status).toBe(404);
  });

  it('says nothing ran for an empty file', async () => {
    const res = await app.request('/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('still renders the good rows when a line is bad', async () => {
    const res = await app.request('/digest/2026-10-26');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('>mid<');
    expect(html).toContain('>zeta<');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines', async () => {
    const res = await app.request('/api/digest/2026-10-28');
    expect(res.status).toBe(200);
    const body = (await res.json()) as Night;
    expect(body.night).toBe('2026-10-28');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'mid', 'quiet', 'zeta']);
    expect(body.rows[0]).toMatchObject({ job: 'alpha', owner: null, runs: 4, retries: 3, lastStatus: 'ok' });
    expect(body.rows[1]).toMatchObject({ job: 'mid', lastStatus: 'fail', lastError: 'boom' });
  });

  it('404s for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-01-01')).status).toBe(404);
  });

  it('returns empty rows for an empty file', async () => {
    const res = await app.request('/api/digest/2026-10-27');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-10-27', rows: [], badLines: 0 });
  });

  it('counts a bad line and keeps the good rows', async () => {
    const res = await app.request('/api/digest/2026-10-26');
    const body = (await res.json()) as Night;
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(1);
    expect(body.rows.map((r) => r.job)).toEqual(['mid', 'zeta']);
  });

  it('lists the same jobs in the same order as the page', async () => {
    const body = (await (await app.request('/api/digest/2026-10-28')).json()) as Night;
    const html = await (await app.request('/digest/2026-10-28')).text();
    const inPage = body.rows
      .map((r) => ({ job: r.job, at: html.indexOf(`>${r.job}<`) }))
      .sort((a, b) => a.at - b.at)
      .map((x) => x.job);
    expect(inPage).toEqual(body.rows.map((r) => r.job));
    expect(body.rows.every((r) => html.indexOf(`>${r.job}<`) >= 0)).toBe(true);
  });
});
