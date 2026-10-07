// A section/page heading in the editorial style: a small mono kicker above a
// serif title, with optional actions on the right and an optional lead line.
export default function PageHeader({ kicker, title, lead, actions }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 border-b border-rule pb-4">
      <div>
        {kicker && <div className="kicker mb-1">{kicker}</div>}
        <h1 className="font-display text-3xl font-semibold leading-tight text-ink">{title}</h1>
        {lead && <p className="mt-1 max-w-prose text-sm text-muted">{lead}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
