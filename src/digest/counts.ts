import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { parseLine } from './read.js';

export type NightCounts = { ok: number; retry: number; fail: number; badLines: number };

// Counts a night's valid lines by status (not per job). Pure over the text.
export function countLines(text: string): NightCounts {
  const c: NightCounts = { ok: 0, retry: 0, fail: 0, badLines: 0 };
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const r = parseLine(line);
    if (r) c[r.status]++;
    else c.badLines++;
  }
  return c;
}

// null when the file can't be read.
export function countNight(runsDir: string, night: string): NightCounts | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(night)) return null;
  try {
    return countLines(readFileSync(join(runsDir, `${night}.jsonl`), 'utf8'));
  } catch {
    return null;
  }
}
