import { useCountUp } from "../hooks/useCountUp";

// A headline statistic: an oversized serif numeral that counts up, a small mono
// label, and an optional icon. Accessibility: the true final number is exposed
// immediately via aria-label (and a visually-hidden span), while the animating
// digits are aria-hidden so a screen reader never reads a flicker of numbers.
export default function StatCard({ label, value, icon: Icon, accent = false }) {
  const shown = useCountUp(value);
  return (
    <div className="flex flex-col gap-1 py-2">
      <div className="flex items-center gap-2">
        {Icon && <Icon aria-hidden="true" className={`h-4 w-4 ${accent ? "text-accent" : "text-muted"}`} />}
        <span className="kicker">{label}</span>
      </div>
      <div
        className={`numeral text-5xl font-semibold ${accent ? "text-accent" : "text-ink"}`}
        aria-label={`${value} ${label}`}
      >
        <span aria-hidden="true">{shown}</span>
      </div>
    </div>
  );
}
