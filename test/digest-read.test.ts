import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read.js';

const tmp = mkdtempSync(join(tmpdir(), 'rig-digest-'));
afterAll(() => rmSync(tmp, { recursive: true, force: true }));

describe('readNight on runs/2026-10-28.jsonl', () => {
  const night = readNight('runs', '2026-10-28');
  const row = (job: string) => night?.rows.find((r) => r.job === job);

  it('gives 5 jobs, sorted by name, and counts the truncated last line', () => {
    expect(night).not.toBeNull();
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('folds retries into one row', () => {
    expect(row('fixtures/refresh')).toEqual({
      job: 'fixtures/refresh',
      owner: 'rook',
      runs: 4,
      retries: 3,
      lastStatus: 'ok',
      lastError: null,
      firstAt: '2026-10-29T01:30:00+01:00',
      lastAt: '2026-10-29T01:37:00+01:00',
    });
  });

  it('keeps the fail and its error', () => {
    expect(row('notes/backup')).toMatchObject({
      owner: 'lane-07',
      runs: 1,
      retries: 0,
      lastStatus: 'fail',
      lastError: 'quota exceeded',
      firstAt: '2026-10-29T04:00:01+01:00',
    });
  });

  it('keeps a row with a null owner, as null', () => {
    expect(row('digest/render')).toMatchObject({ owner: null, runs: 1, lastStatus: 'ok' });
  });

  it('keeps the offset as written', () => {
    expect(row('rig/rotate-logs')?.firstAt).toBe('2026-10-28T23:00:02+01:00');
  });
});

describe('readNight edges', () => {
  it('returns null when the night has no file', () => {
    expect(readNight(tmp, '2026-01-01')).toBeNull();
  });

  it('returns null for a night that is not a date', () => {
    expect(readNight(tmp, '../etc')).toBeNull();
  });

  it('gives zero rows for an empty file', () => {
    writeFileSync(join(tmp, '2026-01-02.jsonl'), '');
    expect(readNight(tmp, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts lines that parse but are not valid records', () => {
    writeFileSync(
      join(tmp, '2026-01-03.jsonl'),
      [
        '{"at":"2026-01-03T01:00:00-08:00","job":"a","status":"ok","owner":"x"}',
        '{"at":"2026-01-03T01:00:00-08:00","job":"a","status":"maybe","owner":"x"}',
        '[1,2]',
        'null',
        '',
      ].join('\n'),
    );
    const n = readNight(tmp, '2026-01-03');
    expect(n?.badLines).toBe(3);
    expect(n?.rows).toHaveLength(1);
  });
});
