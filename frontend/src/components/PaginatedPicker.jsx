import { useState } from "react";

import { useLoader } from "../hooks/useLoader";
import Button from "./Button";
import ErrorMessage from "./ErrorMessage";
import Spinner from "./Spinner";

// A single-select list that loads ONE page at a time from the server (via the
// `load(limit, offset)` function) rather than pulling every row into the browser.
// Used for choosing a cohort or a trainee where the full list could be large.
export default function PaginatedPicker({
  legend,
  load,
  getId,
  getLabel,
  selectedId,
  onSelect,
  name,
  pageSize = 8,
}) {
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useLoader(() => load(pageSize, offset), [offset]);

  const canPrev = offset > 0;
  const canNext = data ? offset + pageSize < data.total : false;

  return (
    <fieldset className="rounded-md border border-slate-300 p-3">
      <legend className="px-1 text-sm font-medium text-slate-700">{legend}</legend>

      {loading && <Spinner label="Loading options..." />}
      <ErrorMessage error={error} />

      {data && data.items.length === 0 && (
        <p className="py-2 text-sm text-slate-500">Nothing to choose from yet.</p>
      )}

      <div className="space-y-1">
        {data?.items.map((item) => {
          const id = getId(item);
          return (
            <label key={id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="radio"
                name={name}
                checked={selectedId === id}
                onChange={() => onSelect(id)}
              />
              {getLabel(item)}
            </label>
          );
        })}
      </div>

      {data && data.total > pageSize && (
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span>
            {offset + 1}–{Math.min(offset + pageSize, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="secondary"
              disabled={!canPrev}
              onClick={() => setOffset(Math.max(0, offset - pageSize))}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="secondary"
              disabled={!canNext}
              onClick={() => setOffset(offset + pageSize)}
            >
              Next
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
