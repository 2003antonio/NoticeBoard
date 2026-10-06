import Button from "./Button";

// Server-driven paging: we only ever hold one page of rows in memory and ask
// the backend for the next/previous window via limit/offset.
export default function Pagination({ total, limit, offset, onChange }) {
  const from = total === 0 ? 0 : offset + 1;
  const to = Math.min(offset + limit, total);
  const canPrev = offset > 0;
  const canNext = offset + limit < total;

  return (
    <div className="flex items-center justify-between pt-3 text-sm text-slate-600">
      <span>
        {from}–{to} of {total}
      </span>
      <div className="flex gap-2">
        <Button
          variant="secondary"
          disabled={!canPrev}
          onClick={() => onChange(Math.max(0, offset - limit))}
        >
          Previous
        </Button>
        <Button variant="secondary" disabled={!canNext} onClick={() => onChange(offset + limit)}>
          Next
        </Button>
      </div>
    </div>
  );
}
