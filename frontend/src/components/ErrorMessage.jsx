// Shows a readable message from an ApiError (or any Error). We only ever read
// err.message, which the client has already made human-friendly, so no raw
// JSON or stack trace reaches the user. Uses the shared "blocked" red tokens so
// it reads correctly in both themes.
export default function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <div
      role="alert"
      className="rounded-md px-4 py-3 text-sm"
      style={{ backgroundColor: "var(--blocked-bg)", color: "var(--blocked-fg)" }}
    >
      {error.message || "Something went wrong."}
    </div>
  );
}
