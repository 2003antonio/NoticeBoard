import { useEffect, useState } from "react";

import { useReducedMotion } from "../hooks/useReducedMotion";

// A completion ring drawn as an SVG, like a pressed seal. The arc sweeps to the
// target percentage on mount; the percentage is also printed in the middle in
// the serif numeral face. Decorative stroke is aria-hidden; the figure as a
// whole carries an accessible label.
export default function Ring({ percent, size = 128, stroke = 10 }) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(100, percent || 0));
  const [shown, setShown] = useState(reduced ? clamped : 0);

  useEffect(() => {
    if (reduced) {
      setShown(clamped);
      return;
    }
    const id = requestAnimationFrame(() => setShown(clamped));
    return () => cancelAnimationFrame(id);
  }, [clamped, reduced]);

  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - shown / 100);

  return (
    <figure className="flex flex-col items-center gap-2" aria-label={`${clamped}% complete`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--rule)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          style={{ transition: "stroke-dashoffset 900ms ease-out" }}
        />
        <text
          x="50%"
          y="50%"
          dominantBaseline="central"
          textAnchor="middle"
          className="numeral"
          fontSize={size * 0.26}
          fill="var(--ink)"
        >
          {clamped}%
        </text>
      </svg>
    </figure>
  );
}
