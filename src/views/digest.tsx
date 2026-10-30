import type { DigestRow, Night } from '../digest/types.js';

const dash = '—';

function isWarn(row: DigestRow): boolean {
  return row.retries >= 3 || row.lastStatus === 'fail';
}

function Row(props: { row: DigestRow }) {
  const r = props.row;
  const warn = isWarn(r);
  return (
    <tr class={warn ? 'warn' : undefined}>
      <td>
        {r.job}
        {warn ? <b> !</b> : null}
      </td>
      <td>{r.owner ?? dash}</td>
      <td>{r.runs}</td>
      <td>{r.retries}</td>
      <td>{r.lastStatus}</td>
      <td>{r.lastError ?? dash}</td>
      <td>{r.firstAt}</td>
      <td>{r.lastAt}</td>
    </tr>
  );
}

export function DigestPage(props: { data: Night }) {
  const { night, rows, badLines } = props.data;
  return (
    <>
      <h1>digest · {night}</h1>
      {rows.length === 0 ? (
        <p>nothing ran</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>job</th>
              <th>owner</th>
              <th>runs</th>
              <th>retries</th>
              <th>last status</th>
              <th>last error</th>
              <th>first</th>
              <th>last</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <Row row={r} />
            ))}
          </tbody>
        </table>
      )}
      {badLines > 0 ? (
        <p class="mute">
          {badLines} {badLines === 1 ? "line didn't" : "lines didn't"} parse
        </p>
      ) : null}
    </>
  );
}

export function DigestNotFound(props: { night: string }) {
  return (
    <>
      <h1>digest · {props.night}</h1>
      <p>no run log for this night</p>
    </>
  );
}
