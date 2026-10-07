// A restrained container: paper-surface, a hairline rule, small radius, no heavy
// shadow. Used sparingly -- the editorial look leans on rules and whitespace.
export default function Card({ className = "", children, ...props }) {
  return (
    <div
      className={`rounded-lg border border-rule bg-surface p-5 ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}
