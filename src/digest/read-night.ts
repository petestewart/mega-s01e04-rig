import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, Night, ReadNight, RunStatus } from './types.js';

type RunLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

const statuses: readonly RunStatus[] = ['ok', 'retry', 'fail'];

function isStatus(v: unknown): v is RunStatus {
  return typeof v === 'string' && statuses.includes(v as RunStatus);
}

// The edge: one log line in, a typed run out, or null for anything off-shape.
function parseLine(line: string): RunLine | null {
  let value: unknown;
  try {
    value = JSON.parse(line);
  } catch {
    return null;
  }
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null;
  const o = value as Record<string, unknown>;
  const ownerOk = typeof o.owner === 'string' || o.owner === null;
  const errorOk = o.error === undefined || typeof o.error === 'string';
  if (typeof o.at !== 'string' || typeof o.job !== 'string' || !isStatus(o.status) || !ownerOk || !errorOk) {
    return null;
  }
  return {
    at: o.at,
    job: o.job,
    status: o.status,
    owner: o.owner as string | null,
    ...(typeof o.error === 'string' ? { error: o.error } : {}),
  };
}

// Folds a run into its job's row. Lines are in log order, so the last run seen is the last run.
function fold(row: DigestRow | undefined, run: RunLine): DigestRow {
  const retries = (row?.retries ?? 0) + (run.status === 'retry' ? 1 : 0);
  const fails = (row?.fails ?? 0) + (run.status === 'fail' ? 1 : 0);
  return {
    job: run.job,
    owner: run.owner,
    runs: (row?.runs ?? 0) + 1,
    retries,
    fails,
    lastStatus: run.status,
    lastError: run.error ?? null,
    firstAt: row?.firstAt ?? run.at,
    lastAt: run.at,
  };
}

export const readNight: ReadNight = (runsDir, night): Night | null => {
  let text: string;
  try {
    text = readFileSync(join(runsDir, `${night}.jsonl`), 'utf8');
  } catch {
    return null;
  }
  const byJob = new Map<string, DigestRow>();
  let badLines = 0;
  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const run = parseLine(line);
    if (run === null) {
      badLines += 1;
      continue;
    }
    byJob.set(run.job, fold(byJob.get(run.job), run));
  }
  // The one sort: code-unit order, so the page and the JSON agree on every machine.
  const rows = [...byJob.values()].sort((a, b) => (a.job < b.job ? -1 : a.job > b.job ? 1 : 0));
  return { night, rows, badLines };
};
