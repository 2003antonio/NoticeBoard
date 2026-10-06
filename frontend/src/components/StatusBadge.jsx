// A coloured label for a pair/report status. Colour is a convenience; the text
// always says the status too, so it does not rely on colour alone.
const STYLES = {
  done: "bg-green-100 text-green-800",
  on_track: "bg-blue-100 text-blue-800",
  blocked: "bg-red-100 text-red-800",
  no_report: "bg-slate-100 text-slate-600",
};

const LABELS = {
  done: "Done",
  on_track: "On track",
  blocked: "Blocked",
  no_report: "No report",
};

export default function StatusBadge({ status }) {
  const style = STYLES[status] || "bg-slate-100 text-slate-600";
  return (
    <span className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${style}`}>
      {LABELS[status] || status}
    </span>
  );
}
