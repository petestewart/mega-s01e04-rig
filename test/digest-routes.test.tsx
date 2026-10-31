import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';
import type { DigestRow } from '../src/digest/types.js';

const line = (at: string, job: string, status: string, owner: string | null, error?: string) =>
  JSON.stringify({ at, job, status, owner, ...(error ? { error } : {}) });

let runsDir = '';
let app: ReturnType<typeof createApp>;

beforeAll(() => {
  runsDir = mkdtempSync(join(tmpdir(), 'digest-routes-'));
  writeFileSync(
    join(runsDir, '2026-01-01.jsonl'),
    [
      line('2026-01-01T02:00:00+01:00', 'zeta', 'ok', 'ana'),
      line('2026-01-01T02:05:00+01:00', 'alpha', 'ok', null),
      line('2026-01-01T02:10:00+01:00', 'mid', 'retry', 'bo'),
      line('2026-01-01T02:11:00+01:00', 'mid', 'retry', 'bo'),
      line('2026-01-01T02:12:00+01:00', 'mid', 'retry', 'bo'),
      line('2026-01-01T02:13:00+01:00', 'mid', 'ok', 'bo'),
      line('2026-01-01T03:00:00+01:00', 'broke', 'fail', 'cy', 'boom'),
    ].join('\n') + '\n',
  );
  writeFileSync(join(runsDir, '2026-01-02.jsonl'), '');
  writeFileSync(
    join(runsDir, '2026-01-03.jsonl'),
    [line('2026-01-03T02:00:00+01:00', 'only', 'ok', 'ana'), 'not json', '{"at":1}'].join('\n') + '\n',
  );
  app = createApp({
    adapter: 'shim',
    installed: '2026-10-29T14:06:00+01:00',
    beatEverySeconds: 60,
    runsDir,
  });
});

afterAll(() => rmSync(runsDir, { recursive: true, force: true }));

const jobsFromHtml = (html: string) =>
  [...html.matchAll(/<tr[^>]*>\s*<td[^>]*>([^<]+)<\/td>/g)].map((m) => m[1]);

describe('GET /digest/:night', () => {
  it('renders one table, sorted by job, with warn rows and an em dash for no owner', async () => {
    const res = await app.request('/digest/2026-01-01');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html.match(/<table/g)).toHaveLength(1);
    expect(jobsFromHtml(html)).toEqual(['alpha', 'broke', 'mid', 'zeta']);
    expect(html).toContain('—');
    const rowOf = (job: string) => html.match(new RegExp(`<tr[^>]*>\\s*<td[^>]*>${job}</td>`))?.[0] ?? '';
    expect(rowOf('broke')).toContain('warn');
    expect(rowOf('mid')).toContain('warn');
    expect(rowOf('alpha')).not.toContain('warn');
    expect(rowOf('zeta')).not.toContain('warn');
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/digest/2026-02-02')).status).toBe(404);
  });

  it('404 for a malformed night', async () => {
    expect((await app.request('/digest/nope')).status).toBe(404);
  });

  it('says nothing ran for an empty night', async () => {
    const res = await app.request('/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('nothing ran');
  });

  it('reports bad lines', async () => {
    const res = await app.request('/digest/2026-01-03');
    expect(res.status).toBe(200);
    expect(await res.text()).toContain('bad lines: 2');
  });
});

describe('GET /api/digest/:night', () => {
  it('returns night, rows and badLines', async () => {
    const res = await app.request('/api/digest/2026-01-01');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { night: string; rows: DigestRow[]; badLines: number };
    expect(body.night).toBe('2026-01-01');
    expect(body.badLines).toBe(0);
    expect(body.rows.map((r) => r.job)).toEqual(['alpha', 'broke', 'mid', 'zeta']);
    expect(body.rows.find((r) => r.job === 'alpha')?.owner).toBeNull();
    expect(body.rows.find((r) => r.job === 'mid')).toMatchObject({ runs: 4, retries: 3, fails: 0, lastStatus: 'ok' });
  });

  it('404 for a night with no file', async () => {
    expect((await app.request('/api/digest/2026-02-02')).status).toBe(404);
  });

  it('404 for a malformed night', async () => {
    expect((await app.request('/api/digest/nope')).status).toBe(404);
  });

  it('has no rows for an empty night', async () => {
    const res = await app.request('/api/digest/2026-01-02');
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ night: '2026-01-02', rows: [], badLines: 0 });
  });

  it('counts bad lines', async () => {
    const res = await app.request('/api/digest/2026-01-03');
    const body = (await res.json()) as { rows: DigestRow[]; badLines: number };
    expect(res.status).toBe(200);
    expect(body.badLines).toBe(2);
    expect(body.rows.map((r) => r.job)).toEqual(['only']);
  });
});

describe('page and JSON agree', () => {
  it('list the same jobs in the same order', async () => {
    const html = await (await app.request('/digest/2026-01-01')).text();
    const body = (await (await app.request('/api/digest/2026-01-01')).json()) as { rows: DigestRow[] };
    expect(jobsFromHtml(html)).toEqual(body.rows.map((r) => r.job));
  });
});
