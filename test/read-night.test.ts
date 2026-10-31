import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { readNight } from '../src/digest/read-night.js';

const row = (job: string) => readNight('runs', '2026-10-28')?.rows.find((r) => r.job === job);

describe('readNight', () => {
  it('reads 2026-10-28: 5 jobs, 1 bad line, sorted by job', () => {
    const night = readNight('runs', '2026-10-28');
    expect(night?.badLines).toBe(1);
    expect(night?.rows.map((r) => r.job)).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
  });

  it('counts retries and clears lastError once the job passes', () => {
    expect(row('fixtures/refresh')).toMatchObject({ retries: 3, lastStatus: 'ok', lastError: null, runs: 4 });
  });

  it('keeps the error of a failed last run', () => {
    expect(row('notes/backup')).toMatchObject({ fails: 1, lastStatus: 'fail', lastError: 'quota exceeded' });
  });

  it('keeps a null owner and the log offset', () => {
    expect(row('digest/render')?.owner).toBeNull();
    expect(row('lane/sync')).toMatchObject({ firstAt: '2026-10-28T23:00:06+01:00', lastAt: '2026-10-29T05:00:04+01:00' });
  });

  it('returns null for a missing night and no rows for an empty file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    expect(readNight(dir, '2026-01-01')).toBeNull();
    writeFileSync(join(dir, '2026-01-02.jsonl'), '');
    expect(readNight(dir, '2026-01-02')).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts valid JSON of the wrong shape as a bad line', () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-'));
    writeFileSync(
      join(dir, '2026-01-03.jsonl'),
      '{"at":"2026-01-03T01:00:00+01:00","job":"a","status":"meh","owner":null}\n[1,2]\n"x"\n',
    );
    expect(readNight(dir, '2026-01-03')).toEqual({ night: '2026-01-03', rows: [], badLines: 3 });
  });
});
