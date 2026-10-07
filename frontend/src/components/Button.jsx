import { Loader2 } from "lucide-react";

// One button, three intents. `loading` shows a spinner inside the button and
// disables it, so a form in flight can't be double-submitted. Primary uses the
// role accent; danger is a fixed red regardless of role.
const VARIANTS = {
  primary: "bg-accent text-accent-contrast hover:opacity-90",
  secondary: "border border-rule bg-surface text-ink hover:bg-paper",
  danger: "bg-red-700 text-white hover:bg-red-800",
  ghost: "text-ink hover:bg-surface",
};

export default function Button({
  variant = "primary",
  loading = false,
  disabled,
  className = "",
  children,
  ...props
}) {
  const base =
    "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium " +
    "transition-[opacity,background-color,color] duration-150 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 " +
    "focus-visible:ring-offset-paper disabled:opacity-50 disabled:cursor-not-allowed";
  return (
    <button className={`${base} ${VARIANTS[variant]} ${className}`} disabled={disabled || loading} {...props}>
      {loading && <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}
