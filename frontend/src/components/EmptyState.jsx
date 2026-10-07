import { Inbox } from "lucide-react";

// Shown when a list has no rows. An empty screen is an invitation to act, so it
// gets an icon and a short, plain line rather than looking broken.
export default function EmptyState({ icon: Icon = Inbox, children }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed border-rule bg-surface px-4 py-10 text-center">
      <Icon aria-hidden="true" className="h-6 w-6 text-muted" />
      <p className="text-sm text-muted">{children}</p>
    </div>
  );
}
