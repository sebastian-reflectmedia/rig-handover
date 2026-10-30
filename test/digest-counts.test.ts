import { expect, it } from 'vitest';
import { countLines } from '../src/digest/counts.js';

it('counts valid lines by status and bad lines apart', () => {
  const l = (status: string) => JSON.stringify({ at: '2026-10-28T01:00:00+01:00', job: 'a', status, owner: null });
  expect(countLines([l('ok'), l('retry'), l('ok'), l('fail'), 'nope', ''].join('\n'))).toEqual({ ok: 2, retry: 1, fail: 1, badLines: 1 });
});
