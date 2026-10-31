import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

// A row is worth a look after three retries or any fail.
function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.fails >= 1;
}

export function DigestPage({ digest }: { digest: Night }) {
  return (
    <>
      <h1>digest {digest.night}</h1>
      {digest.badLines > 0 && <p class="mute">bad lines: {digest.badLines}</p>}
      {digest.rows.length === 0 ? (
        <p class="mute">nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th><th>owner</th><th>runs</th><th>retries</th><th>fails</th>
              <th>last status</th><th>last error</th><th>first</th><th>last</th>
            </tr>
          </thead>
          <tbody>
            {digest.rows.map((r) => (
              <tr class={isWarn(r) ? 'warn' : undefined}>
                <td>{r.job}</td>
                <td>{r.owner ?? dash}</td>
                <td>{r.runs}</td>
                <td>{r.retries}</td>
                <td>{r.fails}</td>
                <td>{r.lastStatus}</td>
                <td>{r.lastError ?? dash}</td>
                <td>{r.firstAt}</td>
                <td>{r.lastAt}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
