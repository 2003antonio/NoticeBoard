import { useState } from "react";
import { Plus, X } from "lucide-react";

import Button from "./Button";
import ErrorMessage from "./ErrorMessage";
import PaginatedPicker from "./PaginatedPicker";

// An "Add X" button that opens a small inline panel with a searchable picker and
// a confirm button, instead of a permanent list on the page. Keyboard friendly:
// the panel is in normal flow with a heading and labelled controls, Escape
// closes it, and the confirm button is disabled until something is chosen.
export default function AddPanel({
  buttonLabel,
  title,
  confirmLabel,
  onConfirm, // async (selectedId) -> void; throwing leaves the panel open
  load,
  getId,
  getLabel,
  name,
  emptyMessage,
}) {
  const [open, setOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  function close() {
    setOpen(false);
    setSelectedId(null);
    setError(null);
  }

  async function confirm() {
    if (!selectedId) return;
    setSubmitting(true);
    setError(null);
    try {
      await onConfirm(selectedId);
      close(); // only on success
    } catch (err) {
      // Keep the panel open and show the message. This is the fallback for a
      // race the picker can't prevent -- e.g. two managers (or two tabs) adding
      // the same trainee at once, where the server returns a 409.
      if (!err.handled) setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (!open) {
    return (
      <Button variant="secondary" onClick={() => setOpen(true)}>
        <Plus className="h-4 w-4" /> {buttonLabel}
      </Button>
    );
  }

  return (
    <div
      className="rounded-lg border border-rule bg-surface p-4"
      onKeyDown={(e) => {
        if (e.key === "Escape") close();
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <h3 className="font-display text-base font-semibold text-ink">{title}</h3>
        <button onClick={close} aria-label="Cancel" className="rounded p-1 text-muted hover:text-ink">
          <X className="h-4 w-4" />
        </button>
      </div>

      <PaginatedPicker
        legend={title}
        name={name}
        load={load}
        getId={getId}
        getLabel={getLabel}
        selectedId={selectedId}
        onSelect={(id) => {
          setError(null); // a new choice clears a stale error
          setSelectedId(id);
        }}
        emptyMessage={emptyMessage}
      />

      {error && (
        <div className="mt-3">
          <ErrorMessage error={error} />
        </div>
      )}

      <div className="mt-3 flex gap-2">
        <Button onClick={confirm} loading={submitting} disabled={!selectedId}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
    </div>
  );
}
