import { useEffect, useState } from "react";
import { Search } from "lucide-react";

import { useLoader } from "../hooks/useLoader";
import Button from "./Button";
import ErrorMessage from "./ErrorMessage";
import Spinner from "./Spinner";
import { inputClass } from "./FormField";

// A single-select list that loads ONE page at a time from the server, with a
// debounced search box. `load(limit, offset, q)` returns {items, total}. Used
// wherever we must only offer what is still available (add member, assign plan).
export default function PaginatedPicker({
  legend,
  load,
  getId,
  getLabel,
  selectedId,
  onSelect,
  name,
  emptyMessage = "Nothing to choose from.",
  pageSize = 6,
}) {
  const [query, setQuery] = useState("");
  const [q, setQ] = useState(""); // debounced value actually sent to the server
  const [offset, setOffset] = useState(0);

  // Debounce typing so each keystroke doesn't fire a request; reset to page 1
  // whenever the search text changes.
  useEffect(() => {
    const id = setTimeout(() => {
      setQ(query.trim());
      setOffset(0);
    }, 250);
    return () => clearTimeout(id);
  }, [query]);

  const { data, loading, error } = useLoader(() => load(pageSize, offset, q), [q, offset]);

  const canPrev = offset > 0;
  const canNext = data ? offset + pageSize < data.total : false;

  return (
    <fieldset className="rounded-md border border-rule bg-surface p-3">
      <legend className="kicker px-1">{legend}</legend>

      <div className="relative mb-2">
        <Search aria-hidden="true" className="pointer-events-none absolute left-2 top-2.5 h-4 w-4 text-muted" />
        <input
          type="search"
          className={`${inputClass} pl-8`}
          placeholder="Search..."
          aria-label={`Search ${legend}`}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading && <Spinner label="Loading options..." />}
      <ErrorMessage error={error} />

      {data && data.items.length === 0 && <p className="py-2 text-sm text-muted">{emptyMessage}</p>}

      <div className="max-h-48 space-y-1 overflow-y-auto">
        {data?.items.map((item) => {
          const id = getId(item);
          return (
            <label
              key={id}
              className="flex cursor-pointer items-center gap-2 rounded px-1 py-1 text-sm text-ink hover:bg-paper"
            >
              <input
                type="radio"
                name={name}
                className="accent-[var(--accent)]"
                checked={selectedId === id}
                onChange={() => onSelect(id)}
              />
              {getLabel(item)}
            </label>
          );
        })}
      </div>

      {data && data.total > pageSize && (
        <div className="mt-2 flex items-center justify-between text-xs text-muted">
          <span className="tnum">
            {offset + 1}–{Math.min(offset + pageSize, data.total)} of {data.total}
          </span>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={!canPrev} onClick={() => setOffset(Math.max(0, offset - pageSize))}>
              Prev
            </Button>
            <Button type="button" variant="secondary" disabled={!canNext} onClick={() => setOffset(offset + pageSize)}>
              Next
            </Button>
          </div>
        </div>
      )}
    </fieldset>
  );
}
