// A small, accessible loading indicator. role=status lets screen readers
// announce that something is loading.
export default function Spinner({ label = "Loading..." }) {
  return (
    <div role="status" className="flex items-center gap-2 text-slate-500 py-6">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
      <span>{label}</span>
    </div>
  );
}
