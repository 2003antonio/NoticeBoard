import { ArrowRight } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";

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

// A whole-row link WITHOUT making the <tr> a nonstandard interactive element.
// The real link is a single <StretchedLink> in the title cell: its CSS ::after
// covers the whole row, so the table keeps valid semantics, there is exactly one
// tab stop, and native keyboard activation (Enter) just works. The onClick is a
// mouse-only convenience pointing at the same route, so it never double-navigates
// anywhere new. Use <StretchedLink to=...> in the first cell of the children.
export function RowLink({ to, className = "", children }) {
  const navigate = useNavigate();
  return (
    <tr
      className={`relative cursor-pointer border-b border-rule/70 transition-colors last:border-0 hover:bg-paper ${className}`}
      onClick={() => navigate(to)}
    >
      {children}
    </tr>
  );
}

// The one real, focusable link for a RowLink, stretched over the row via ::after.
export function StretchedLink({ to, children, className = "" }) {
  return (
    <Link
      to={to}
      // after:absolute after:inset-0 makes the link's hit area the whole row.
      // relative keeps the visible text above the overlay; the focus ring shows
      // around the title so keyboard focus is obvious.
      onClick={(e) => e.stopPropagation()}
      className={`relative font-medium text-ink after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent rounded-sm ${className}`}
    >
      {children}
    </Link>
  );
}

// A purely-visual "Open" affordance for a RowLink (the StretchedLink is the real
// link, so this stays non-interactive to avoid a nested control).
export function OpenHint() {
  return (
    <span aria-hidden="true" className="inline-flex items-center gap-1 font-medium text-accent">
      Open <ArrowRight className="h-3.5 w-3.5" />
    </span>
  );
}
