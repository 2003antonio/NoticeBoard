import { Link } from "react-router-dom";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-paper px-4 text-center">
      <p className="kicker">Error 404</p>
      <h1 className="font-display text-5xl font-semibold text-ink">Page not found</h1>
      <p className="text-muted">That page does not exist.</p>
      <Link to="/" className="mt-2 font-medium text-accent hover:underline">
        Go home
      </Link>
    </div>
  );
}
