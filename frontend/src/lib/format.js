// Small display helpers. The backend sends ISO dates/times; we show short,
// local, human versions and never crash on a null value.

export function formatDate(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString();
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleString();
}

// Friendly "2 hours ago" style, falling back to a date for anything older than
// a week. Keeps notifications readable at a glance.
export function relativeTime(value) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  const secs = Math.round((Date.now() - d.getTime()) / 1000);
  const rtf = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
  const steps = [
    ["minute", 60],
    ["hour", 3600],
    ["day", 86400],
  ];
  if (secs < 60) return "just now";
  for (let i = steps.length - 1; i >= 0; i--) {
    const [unit, size] = steps[i];
    if (secs >= size) {
      if (unit === "day" && secs >= 7 * 86400) return d.toLocaleDateString();
      return rtf.format(-Math.floor(secs / size), unit);
    }
  }
  return d.toLocaleDateString();
}
