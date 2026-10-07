import { useEffect, useState } from "react";

import { useReducedMotion } from "../hooks/useReducedMotion";

// A thin completion bar. It animates its width from 0 to the target on mount
// (unless reduced motion is requested, in which case it just shows the target).
export default function ProgressBar({ percent, className = "" }) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const [width, setWidth] = useState(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      setWidth(clamped);
      return;
    }
    // Next frame so the transition runs from 0 to the target.
    const id = requestAnimationFrame(() => setWidth(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped, reduced]);

  return (
    <div
      className={`h-1.5 w-full overflow-hidden rounded-full bg-rule ${className}`}
      role="progressbar"
      aria-valuenow={clamped}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-full rounded-full bg-accent transition-[width] duration-700 ease-out"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}
