import { Loader2 } from "lucide-react";

// A small, accessible loading indicator. role=status lets screen readers
// announce that something is loading.
export default function Spinner({ label = "Loading..." }) {
  return (
    <div role="status" className="flex items-center gap-2 py-6 text-sm text-muted">
      <Loader2 aria-hidden="true" className="h-4 w-4 animate-spin" />
      <span>{label}</span>
    </div>
  );
}
