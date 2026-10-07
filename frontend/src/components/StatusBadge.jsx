// A status pill. Colour is backed by a text label and a small dot, so meaning
// never rests on colour alone. The tint/foreground pairs live in index.css as
// CSS variables (one set per theme), each checked for 4.5:1 contrast.
const LABELS = {
  done: "Done",
  on_track: "On track",
  blocked: "Blocked",
  no_report: "No report",
  overdue: "Overdue",
  missing: "Missing",
};

export default function StatusBadge({ status }) {
  const key = LABELS[status] ? status : "no_report";
  return (
    <span
      className="badge"
      style={{ backgroundColor: `var(--${key}-bg)`, color: `var(--${key}-fg)` }}
    >
      <span aria-hidden="true" className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: "currentColor" }} />
      {LABELS[status] || status}
    </span>
  );
}
