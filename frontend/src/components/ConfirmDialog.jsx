import { useEffect, useRef } from "react";

import Button from "./Button";

// A small accessible confirmation modal in the editorial style. Only rendered
// while open. On open it moves focus to the confirm button and remembers which
// element opened it; on close (confirm, cancel, or Escape) it restores focus
// there. Escape cancels, and Tab is trapped between the two buttons so keyboard
// focus can't wander behind the dialog.
export default function ConfirmDialog({
  title,
  children,
  confirmLabel = "Confirm",
  cancelLabel = "Go back",
  confirmVariant = "primary",
  onConfirm,
  onCancel,
}) {
  const confirmRef = useRef(null);
  const cancelRef = useRef(null);

  useEffect(() => {
    const opener = document.activeElement; // e.g. the submit button that opened this
    confirmRef.current?.focus();
    return () => {
      // Restore focus to whatever opened the dialog (the submit button).
      if (opener && typeof opener.focus === "function") opener.focus();
    };
  }, []);

  function onKeyDown(e) {
    if (e.key === "Escape") {
      e.preventDefault();
      onCancel();
      return;
    }
    // Trap Tab between the two buttons.
    if (e.key === "Tab") {
      const first = cancelRef.current;
      const last = confirmRef.current;
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last?.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first?.focus();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4"
      onClick={onCancel} // click the backdrop to cancel
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-title"
        className="w-full max-w-sm rounded-lg border border-rule bg-surface p-5 shadow-sm"
        onClick={(e) => e.stopPropagation()} // keep clicks inside from closing it
        onKeyDown={onKeyDown}
      >
        <h2 id="confirm-title" className="font-display text-lg font-semibold text-ink">
          {title}
        </h2>
        <div className="mt-2 text-sm text-muted">{children}</div>
        <div className="mt-5 flex justify-end gap-2">
          <Button ref={cancelRef} variant="secondary" onClick={onCancel}>
            {cancelLabel}
          </Button>
          <Button ref={confirmRef} variant={confirmVariant} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
