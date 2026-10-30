import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, JobStatus, Night, ReadNight, RunRecord } from './types.js';

const NIGHT = /^\d{4}-\d{2}-\d{2}$/;
const STATUSES: readonly string[] = ['ok', 'retry', 'fail'] satisfies JobStatus[];

// The edge: one raw line in, a RunRecord or null out. Nothing past here sees unparsed input.
export function parseLine(line: string): RunRecord | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const v = value as Record<string, unknown>;
  if (typeof v.at !== 'string' || v.at === '') return null;
  if (typeof v.job !== 'string' || v.job === '') return null;
  if (typeof v.status !== 'string' || !STATUSES.includes(v.status)) return null;
  if (v.owner !== null && typeof v.owner !== 'string') return null;
  if (v.error !== undefined && typeof v.error !== 'string') return null;
  const record: RunRecord = { at: v.at, job: v.job, status: v.status as JobStatus, owner: v.owner };
  if (v.error !== undefined) record.error = v.error;
  return record;
}

export const readNight: ReadNight = (runsDir, night) => {
  if (!NIGHT.test(night)) return null;
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }

  let badLines = 0;
  const byJob = new Map<string, DigestRow>();
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const r = parseLine(line);
    if (!r) {
      badLines++;
      continue;
    }
    const row = byJob.get(r.job);
    if (!row) {
      byJob.set(r.job, {
        job: r.job,
        owner: r.owner,
        runs: 1,
        retries: r.status === 'retry' ? 1 : 0,
        lastStatus: r.status,
        lastError: r.error ?? null,
        firstAt: r.at,
        lastAt: r.at,
      });
      continue;
    }
    row.runs++;
    if (r.status === 'retry') row.retries++;
    row.owner = r.owner;
    row.lastStatus = r.status;
    row.lastError = r.error ?? null;
    row.lastAt = r.at;
  }

  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines } satisfies Night;
};
