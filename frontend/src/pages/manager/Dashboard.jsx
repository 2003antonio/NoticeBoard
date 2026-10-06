import { useState } from "react";

import { cohortRows, summary, traineeRows } from "../../api/dashboard";
import { listCohorts } from "../../api/cohorts";
import { listPlans } from "../../api/plans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PaginatedPicker from "../../components/PaginatedPicker";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import Table from "../../components/Table";

const PAGE = 20;

export default function Dashboard() {
  return (
    <div className="space-y-8">
      <h1 className="text-xl font-semibold text-slate-800">Dashboard</h1>
      <SummarySection />
      <CohortSection />
      <DrilldownSection />
    </div>
  );
}

// ---- summary cards ----

function SummarySection() {
  const { data, loading, error } = useLoader(() => summary(), []);
  if (loading) return <Spinner />;
  if (error) return <ErrorMessage error={error} />;

  const cards = [
    { label: "Total", value: data.total_pairs },
    { label: "Done", value: data.done },
    { label: "On track", value: data.on_track },
    { label: "Blocked", value: data.blocked },
    { label: "No report", value: data.no_report },
    { label: "Overdue", value: data.overdue },
    { label: "Missing", value: data.missing },
    { label: "Needs attention", value: data.needs_attention },
  ];

  return (
    <section className="space-y-3">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-lg border border-slate-200 bg-white p-4">
            <div className="text-2xl font-semibold text-slate-800">{c.value}</div>
            <div className="text-xs text-slate-500">{c.label}</div>
          </div>
        ))}
      </div>
      <p className="text-sm text-slate-600">
        Completion: <strong>{data.completion_percent}%</strong> ({data.done} of {data.total_pairs}{" "}
        pairs done) · {data.active_trainees} active trainees · {data.cohorts} cohorts · {data.plans} plans
      </p>
      <p className="text-xs text-slate-500">
        A pair is one trainee on one plan. <strong>Overdue</strong> = past the due date and not done.{" "}
        <strong>Missing</strong> = not done and no activity for more than 7 days.
      </p>
    </section>
  );
}

// ---- cohort table ----

function CohortSection() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useLoader(() => cohortRows(PAGE, offset), [offset]);

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800">By cohort</h2>
      {loading && <Spinner />}
      <ErrorMessage error={error} />
      {data && data.items.length === 0 && <EmptyState>No cohorts yet.</EmptyState>}
      {data && data.items.length > 0 && (
        <>
          <Table head={["Cohort", "Members", "Plans", "Pairs", "Done", "Blocked", "Overdue", "Missing", "Attention", "Completion"]}>
            {data.items.map((c) => (
              <tr key={c.cohort_id}>
                <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                <td className="px-4 py-2">{c.member_count}</td>
                <td className="px-4 py-2">{c.plan_count}</td>
                <td className="px-4 py-2">{c.total_pairs}</td>
                <td className="px-4 py-2">{c.done}</td>
                <td className="px-4 py-2">{c.blocked}</td>
                <td className="px-4 py-2">{c.overdue}</td>
                <td className="px-4 py-2">{c.missing}</td>
                <td className="px-4 py-2 font-medium">{c.needs_attention}</td>
                <td className="px-4 py-2">{c.completion_percent}%</td>
              </tr>
            ))}
          </Table>
          <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </>
      )}
    </section>
  );
}

// ---- drill-down with filters ----

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "on_track", label: "On track" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "no_report", label: "No report" },
];

function DrilldownSection() {
  // "pending" is what the user is editing; "applied" is what we actually query.
  // Filters apply on a button click so typing/clicking does not spam the API.
  const [pending, setPending] = useState({ cohort_id: null, plan_id: null, status: "", attention_only: false });
  const [applied, setApplied] = useState({ ...pending });
  const [offset, setOffset] = useState(0);

  const appliedKey = JSON.stringify(applied);
  const { data, loading, error } = useLoader(
    () => traineeRows(applied, PAGE, offset),
    [appliedKey, offset]
  );

  function apply() {
    setOffset(0);
    setApplied({ ...pending });
  }

  function clearAll() {
    const empty = { cohort_id: null, plan_id: null, status: "", attention_only: false };
    setPending(empty);
    setApplied(empty);
    setOffset(0);
  }

  return (
    <section className="space-y-3">
      <h2 className="font-semibold text-slate-800">Drill-down</h2>

      <div className="space-y-3 rounded-lg border border-slate-200 bg-white p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <PickerWithClear
            legend="Filter by cohort"
            name="filter-cohort"
            load={listCohorts}
            getLabel={(c) => c.name}
            selectedId={pending.cohort_id}
            onSelect={(id) => setPending((p) => ({ ...p, cohort_id: id }))}
          />
          <PickerWithClear
            legend="Filter by plan"
            name="filter-plan"
            load={listPlans}
            getLabel={(p) => p.title}
            selectedId={pending.plan_id}
            onSelect={(id) => setPending((p) => ({ ...p, plan_id: id }))}
          />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm text-slate-700">
            Status{" "}
            <select
              className="rounded-md border border-slate-300 px-2 py-1 text-sm"
              value={pending.status}
              onChange={(e) => setPending((p) => ({ ...p, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              checked={pending.attention_only}
              onChange={(e) => setPending((p) => ({ ...p, attention_only: e.target.checked }))}
            />
            Attention only
          </label>

          <div className="flex gap-2">
            <Button type="button" onClick={apply}>
              Apply filters
            </Button>
            <Button type="button" variant="secondary" onClick={clearAll}>
              Clear
            </Button>
          </div>
        </div>
      </div>

      {loading && <Spinner />}
      <ErrorMessage error={error} />
      {data && data.items.length === 0 && <EmptyState>No pairs match these filters.</EmptyState>}
      {data && data.items.length > 0 && (
        <>
          <Table head={["Trainee", "Plan", "Due", "Status", "Last activity", "Source", "Flags"]}>
            {data.items.map((r) => (
              <tr key={`${r.trainee_id}-${r.plan_id}`} className={r.needs_attention ? "bg-amber-50" : ""}>
                <td className="px-4 py-2">
                  <div className="font-medium text-slate-800">{r.trainee_name}</div>
                  <div className="text-xs text-slate-500">{r.trainee_email}</div>
                </td>
                <td className="px-4 py-2 text-slate-700">{r.plan_title}</td>
                <td className="px-4 py-2">{formatDate(r.due_date)}</td>
                <td className="px-4 py-2">
                  <StatusBadge status={r.latest_status} />
                </td>
                <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                  {r.last_report_at ? formatDateTime(r.last_report_at) : "—"}
                </td>
                <td className="px-4 py-2 text-slate-600">{r.source}</td>
                <td className="px-4 py-2 text-xs">
                  <Flags r={r} />
                </td>
              </tr>
            ))}
          </Table>
          <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </>
      )}
    </section>
  );
}

function Flags({ r }) {
  const flags = [];
  if (r.is_overdue) flags.push("Overdue");
  if (r.is_missing) flags.push("Missing");
  if (r.latest_status === "blocked") flags.push("Blocked");
  if (flags.length === 0) return <span className="text-slate-400">—</span>;
  return <span className="text-amber-800">{flags.join(", ")}</span>;
}

// A picker plus a small "Any" button that clears the selection for that filter.
function PickerWithClear({ legend, name, load, getLabel, selectedId, onSelect }) {
  return (
    <div className="space-y-1">
      <PaginatedPicker
        legend={legend}
        name={name}
        load={load}
        getId={(x) => x.id}
        getLabel={getLabel}
        selectedId={selectedId}
        onSelect={onSelect}
      />
      {selectedId && (
        <button type="button" className="text-xs text-blue-600 hover:underline" onClick={() => onSelect(null)}>
          Clear selection
        </button>
      )}
    </div>
  );
}
