// Plan morning-digest § 1. The contract every part of § 2 starts against; the reader lives beside it.
export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  fails: number;
  lastStatus: RunStatus;
  lastError: string | null;
  // As written in the log, offset included.
  firstAt: string;
  lastAt: string;
};

// Rows are sorted by job. A line that doesn't parse lands in badLines, never in rows.
export type Night = {
  night: string;
  rows: DigestRow[];
  badLines: number;
};

// null when the night has no file; an empty file is a Night with no rows.
export type ReadNight = (runsDir: string, night: string) => Night | null;
