// Plan morning-digest § 1. The run log reader's contract: § 2 (page, JSON, board link, route
// tests) builds against these types only. Implementation: ./read.ts.

export type JobStatus = 'ok' | 'retry' | 'fail';

// One line of runs/<night>.jsonl, after parsing at the edge.
export type RunRecord = {
  at: string; // as written in the log, offset kept (never converted to UTC)
  job: string;
  status: JobStatus;
  owner: string | null;
  error?: string;
};

// One row per job for the night.
export type DigestRow = {
  job: string;
  owner: string | null; // null stays null in the data; views show `—`
  runs: number; // lines for this job
  retries: number; // lines for this job with status `retry`
  lastStatus: JobStatus; // status of the job's last line
  lastError: string | null; // `error` of the job's last line, null if it had none
  firstAt: string; // `at` of the job's first line, offset as in the log
  lastAt: string; // `at` of the job's last line, offset as in the log
};

// A night that has a file. An empty file gives `rows: []` ("nothing ran").
export type Night = {
  night: string; // YYYY-MM-DD
  rows: DigestRow[]; // sorted by job name
  badLines: number; // lines that didn't parse or aren't a valid record; counted, never thrown
};

// Returns null when there is no file for that night (routes answer 404), including a `night`
// that isn't a YYYY-MM-DD date. Never throws on bad lines.
export type ReadNight = (runsDir: string, night: string) => Night | null;
