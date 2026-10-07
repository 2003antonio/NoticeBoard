import { useEffect, useState } from "react";

// True when the viewer has asked the OS for reduced motion. Components use this
// to skip animations (count-up, bar fills) and show the final state directly.
export function useReducedMotion() {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia !== "undefined" && matchMedia("(prefers-reduced-motion: reduce)").matches
  );

  useEffect(() => {
    const mq = matchMedia("(prefers-reduced-motion: reduce)");
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}
