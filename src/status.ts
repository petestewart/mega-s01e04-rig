import { readdirSync } from 'node:fs';
import type { RigConfig } from './config.js';
import { readNight } from './digest/read-night.js';
import { lastBeat, type Beat } from './heartbeat.js';

export type Status = {
  adapter: string;
  installed: string;
  lastBeat: Beat | null;
  nights: string[];
  // Counts of log lines by status, summed over the digest rows. null when the night can't be read.
  nightCounts: Record<string, NightCounts | null>;
};

export type NightCounts = { ok: number; retry: number; fail: number };

export function countNight(runsDir: string, night: string): NightCounts | null {
  const n = readNight(runsDir, night);
  if (n === null) return null;
  const c: NightCounts = { ok: 0, retry: 0, fail: 0 };
  for (const r of n.rows) {
    c.retry += r.retries;
    c.fail += r.fails;
    c.ok += r.runs - r.retries - r.fails;
  }
  return c;
}

// Nights on disk = runs/<YYYY-MM-DD>.jsonl, newest first.
export function nightsOnDisk(runsDir: string): string[] {
  try {
    return readdirSync(runsDir)
      .filter((f) => /^\d{4}-\d{2}-\d{2}\.jsonl$/.test(f))
      .map((f) => f.slice(0, 10))
      .sort()
      .reverse();
  } catch {
    return [];
  }
}

export function readStatus(config: RigConfig): Status {
  const nights = nightsOnDisk(config.runsDir);
  return {
    adapter: config.adapter,
    installed: config.installed,
    lastBeat: lastBeat(),
    nights,
    nightCounts: Object.fromEntries(nights.map((n) => [n, countNight(config.runsDir, n)])),
  };
}
