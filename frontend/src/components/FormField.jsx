// A labelled input with an optional error line. Every field has a real <label>
// tied to the control via htmlFor/id, which keyboard and screen-reader users need.
export default function FormField({ label, id, error, children, hint }) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="text-xs text-slate-500">{hint}</p>}
      {error && (
        <p id={`${id}-error`} className="text-xs text-red-700">
          {error}
        </p>
      )}
    </div>
  );
}

// Shared input styling so every text box looks the same and has a visible focus ring.
export const inputClass =
  "block w-full rounded-md border border-slate-300 px-3 py-2 text-sm " +
  "focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-200 " +
  "disabled:bg-slate-100 disabled:text-slate-500";
