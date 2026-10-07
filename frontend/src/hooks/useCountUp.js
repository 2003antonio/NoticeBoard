import { useEffect, useRef, useState } from "react";

import { useReducedMotion } from "./useReducedMotion";

// Counts from 0 up to `target` for a small bit of life on the dashboard. Under
// reduced motion it returns the target immediately (no animation). The REAL
// final value should always be exposed to assistive tech by the caller (an
// aria-label with the true number), while the animating text is aria-hidden.
export function useCountUp(target, { duration = 900 } = {}) {
  const reduced = useReducedMotion();
  const [value, setValue] = useState(reduced ? target : 0);
  const frame = useRef(0);

  useEffect(() => {
    if (reduced) {
      setValue(target);
      return;
    }
    const start = performance.now();
    const from = 0;
    const tick = (now) => {
      const p = Math.min(1, (now - start) / duration);
      // easeOutCubic: fast then gently settling.
      const eased = 1 - Math.pow(1 - p, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (p < 1) frame.current = requestAnimationFrame(tick);
    };
    frame.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame.current);
  }, [target, duration, reduced]);

  return value;
}
