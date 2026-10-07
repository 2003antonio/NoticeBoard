import { createContext, useCallback, useContext, useState } from "react";
import { Check, Info, X } from "lucide-react";

// A tiny toast system (no library). Screens call useToast().show("Saved") for a
// brief success confirmation instead of leaving inline text on the page. The
// container is an aria-live region so screen readers hear the message.
const ToastContext = createContext(null);

let nextId = 1;

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  const show = useCallback(
    (message, { tone = "success", duration = 3000 } = {}) => {
      const id = nextId++;
      setToasts((list) => [...list, { id, message, tone }]);
      if (duration) setTimeout(() => dismiss(id), duration);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ show }}>
      {children}
      <div className="pointer-events-none fixed bottom-4 right-4 z-50 flex flex-col gap-2" aria-live="polite">
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-fade-in pointer-events-auto flex items-center gap-2 rounded-md border border-rule bg-surface px-3 py-2 text-sm text-ink shadow-sm"
          >
            {t.tone === "success" ? (
              <Check aria-hidden="true" className="h-4 w-4" style={{ color: "var(--done-fg)" }} />
            ) : (
              <Info aria-hidden="true" className="h-4 w-4 text-muted" />
            )}
            <span>{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="ml-1 rounded p-0.5 text-muted hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
