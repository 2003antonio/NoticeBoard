// A ledger-style table: a sticky header, hairline-ruled rows, and quiet hover.
// Numbers in cells should use the `tnum` class (via the pages) so columns of
// figures line up like a ledger. Scrolls sideways on a narrow phone.
export default function Table({ head, children }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-rule bg-surface">
      <table className="min-w-full text-sm">
        <thead className="sticky top-0 z-10 bg-surface">
          <tr className="border-b border-rule">
            {head.map((h) => (
              <th
                key={h}
                scope="col"
                className="kicker px-4 py-3 text-left font-normal"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// A body row with the shared hover + hairline treatment. Pages compose their
// own <td>s inside this so each table controls its own columns.
export function Row({ className = "", children, ...props }) {
  return (
    <tr
      className={`border-b border-rule/70 transition-colors last:border-0 hover:bg-paper ${className}`}
      {...props}
    >
      {children}
    </tr>
  );
}
