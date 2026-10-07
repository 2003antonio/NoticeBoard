// A loading placeholder that mimics the shape of the content to come, which
// feels calmer than a bare spinner. The shimmer stops under reduced motion
// (the global media query freezes the animation).
export function SkeletonLine({ className = "" }) {
  return <div className={`h-4 animate-pulse rounded bg-rule ${className}`} />;
}

// A few placeholder rows for a table that is still loading.
export function SkeletonTable({ rows = 5, cols = 4 }) {
  return (
    <div className="space-y-3 rounded-lg border border-rule bg-surface p-4" aria-hidden="true">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-4" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} className={c === 0 ? "w-3/4" : "w-1/2"} />
          ))}
        </div>
      ))}
    </div>
  );
}
