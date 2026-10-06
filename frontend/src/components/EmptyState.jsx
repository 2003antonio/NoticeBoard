// Shown when a list has no rows, so the screen never looks broken or blank.
export default function EmptyState({ children }) {
  return (
    <div className="rounded-md border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
      {children}
    </div>
  );
}
