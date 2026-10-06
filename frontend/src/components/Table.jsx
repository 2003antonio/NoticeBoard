// A thin wrapper so every table on the site looks the same and scrolls sideways
// on a narrow phone instead of breaking the layout. `head` is an array of column
// titles; the rows are passed as children.
export default function Table({ head, children }) {
  return (
    <div className="overflow-x-auto rounded-md border border-slate-200 bg-white">
      <table className="min-w-full divide-y divide-slate-200 text-sm">
        <thead className="bg-slate-50">
          <tr>
            {head.map((h) => (
              <th key={h} scope="col" className="px-4 py-2 text-left font-semibold text-slate-600">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">{children}</tbody>
      </table>
    </div>
  );
}
