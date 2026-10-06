// Shows a readable message from an ApiError (or any Error). We only ever read
// err.message, which the client has already made human-friendly, so no raw
// JSON or stack trace can reach the user.
export default function ErrorMessage({ error }) {
  if (!error) return null;
  return (
    <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
      {error.message || "Something went wrong."}
    </div>
  );
}
