// A labelled control with an optional hint and inline error. Every field has a
// real <label> tied to its control, a visible focus ring, and error text right
// under the field where it is easy to connect to the problem.
export default function FormField({ label, id, error, children, hint }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block text-sm font-medium text-ink">
        {label}
      </label>
      {children}
      {hint && !error && <p className="text-xs text-muted">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs font-medium" style={{ color: "var(--blocked-fg)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

// Shared input styling: surface background, hairline border, a clear accent
// focus ring, and a muted disabled state.
export const inputClass =
  "block w-full rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink " +
  "placeholder:text-muted focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40 " +
  "disabled:opacity-60";
