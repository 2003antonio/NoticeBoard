import { useState } from "react";
import { AlertCircle, CheckCircle2, CircleDashed, Clock, Info, ListChecks } from "lucide-react";

import { cohortRows, summary, traineeRows } from "../../api/dashboard";
import { listCohorts } from "../../api/cohorts";
import { listPlans } from "../../api/plans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import PaginatedPicker from "../../components/PaginatedPicker";
import Pagination from "../../components/Pagination";
import ProgressBar from "../../components/ProgressBar";
import Ring from "../../components/Ring";
import { SkeletonTable } from "../../components/Skeleton";
import Spinner from "../../components/Spinner";
import StatCard from "../../components/StatCard";
import StatusBadge from "../../components/StatusBadge";
import Table, { Row } from "../../components/Table";

const PAGE = 20;

export default function Dashboard() {
  return (
    <div className="space-y-10">
      <PageHeader kicker="Manager" title="Dashboard" lead="Who is on track, and who needs attention, across every plan." />
      <SummarySection />
      <CohortSection />
      <DrilldownSection />
    </div>
  );
}

// ---- headline summary: a designed report, not a grid of identical boxes ----

function SummarySection() {
  const { data, loading, error } = useLoader(() => summary(), []);
  if (loading) return <Spinner label="Loading summary..." />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <section className="space-y-6">
      <div className="grid items-center gap-8 border-b border-rule pb-8 sm:grid-cols-[auto_1fr]">
        {/* The seal: overall completion. */}
        <div className="flex flex-col items-center gap-2">
          <Ring percent={data.completion_percent} />
          <p className="kicker text-center">
            {data.done} of {data.total_pairs} done
          </p>
        </div>

        {/* The two numbers that matter most, oversized. */}
        <div className="grid grid-cols-2 gap-6 sm:grid-cols-3">
          <StatCard label="Total pairs" value={data.total_pairs} icon={ListChecks} />
          <StatCard label="Needs attention" value={data.needs_attention} icon={AlertCircle} accent />
          <StatCard label="Active trainees" value={data.active_trainees} icon={CheckCircle2} />
        </div>
      </div>

      {/* The full breakdown, in a quiet rule-separated strip. */}
      <div className="grid grid-cols-2 gap-x-6 gap-y-4 divide-rule sm:grid-cols-3 lg:grid-cols-6 lg:divide-x">
        <StatCard label="Done" value={data.done} icon={CheckCircle2} />
        <StatCard label="On track" value={data.on_track} icon={CircleDashed} />
        <StatCard label="Blocked" value={data.blocked} icon={AlertCircle} />
        <StatCard label="No report" value={data.no_report} icon={CircleDashed} />
        <StatCard label="Overdue" value={data.overdue} icon={Clock} />
        <StatCard label="Missing" value={data.missing} icon={Clock} />
      </div>

      <p className="flex items-start gap-2 rounded-md border border-rule bg-surface px-4 py-3 text-sm text-muted">
        <Info aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          A <strong className="text-ink">pair</strong> is one trainee on one plan.{" "}
          <strong className="text-ink">Overdue</strong> means past the due date and not done.{" "}
          <strong className="text-ink">Missing</strong> means not done and no activity for more than 7 days.
        </span>
      </p>
    </section>
  );
}

// ---- by cohort: ledger with an inline progress bar per row ----

function CohortSection() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useLoader(() => cohortRows(PAGE, offset), [offset]);

  return (
    <section className="space-y-3">
      <h2 className="font-display text-xl font-semibold text-ink">By cohort</h2>
      {loading && <SkeletonTable rows={3} cols={6} />}
      <ErrorMessage error={error} />
      {data && data.items.length === 0 && <EmptyState>No cohorts yet.</EmptyState>}
      {data && data.items.length > 0 && (
        <>
          <Table head={["Cohort", "Members", "Plans", "Pairs", "Blocked", "Overdue", "Missing", "Attention", "Completion"]}>
            {data.items.map((c) => (
              <Row key={c.cohort_id}>
                <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                <td className="px-4 py-3 tnum text-muted">{c.member_count}</td>
                <td className="px-4 py-3 tnum text-muted">{c.plan_count}</td>
                <td className="px-4 py-3 tnum text-muted">{c.total_pairs}</td>
                <td className="px-4 py-3 tnum">{c.blocked > 0 ? <strong style={{ color: "var(--blocked-fg)" }}>{c.blocked}</strong> : "0"}</td>
                <td className="px-4 py-3 tnum">{c.overdue > 0 ? <strong style={{ color: "var(--overdue-fg)" }}>{c.overdue}</strong> : "0"}</td>
                <td className="px-4 py-3 tnum">{c.missing > 0 ? <strong style={{ color: "var(--missing-fg)" }}>{c.missing}</strong> : "0"}</td>
                <td className="px-4 py-3 tnum">{c.needs_attention > 0 ? <strong className="text-accent">{c.needs_attention}</strong> : "0"}</td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    <ProgressBar percent={c.completion_percent} className="w-20" />
                    <span className="tnum text-xs text-muted">{c.completion_percent}%</span>
                  </div>
                </td>
              </Row>
            ))}
          </Table>
          <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </>
      )}
    </section>
  );
}

// ---- drill-down with apply-on-click filters ----

const STATUS_OPTIONS = [
  { value: "", label: "Any status" },
  { value: "on_track", label: "On track" },
  { value: "blocked", label: "Blocked" },
  { value: "done", label: "Done" },
  { value: "no_report", label: "No report" },
];

function DrilldownSection() {
  const [pending, setPending] = useState({ cohort_id: null, plan_id: null, status: "", attention_only: false });
  const [applied, setApplied] = useState({ ...pending });
  const [offset, setOffset] = useState(0);

  const appliedKey = JSON.stringify(applied);
  const { data, loading, error } = useLoader(() => traineeRows(applied, PAGE, offset), [appliedKey, offset]);

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
    <section className="space-y-4">
      <h2 className="font-display text-xl font-semibold text-ink">Drill-down</h2>

      <div className="space-y-4 rounded-lg border border-rule bg-surface p-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <PickerWithClear legend="Filter by cohort" name="filter-cohort" load={listCohorts} getLabel={(c) => c.name} selectedId={pending.cohort_id} onSelect={(id) => setPending((p) => ({ ...p, cohort_id: id }))} />
          <PickerWithClear legend="Filter by plan" name="filter-plan" load={listPlans} getLabel={(p) => p.title} selectedId={pending.plan_id} onSelect={(id) => setPending((p) => ({ ...p, plan_id: id }))} />
        </div>

        <div className="flex flex-wrap items-center gap-4">
          <label className="text-sm text-ink">
            <span className="kicker mr-2">Status</span>
            <select
              className="rounded-md border border-rule bg-surface px-2 py-1 text-sm"
              value={pending.status}
              onChange={(e) => setPending((p) => ({ ...p, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </label>

          <label className="flex items-center gap-2 text-sm text-ink">
            <input type="checkbox" className="accent-[var(--accent)]" checked={pending.attention_only} onChange={(e) => setPending((p) => ({ ...p, attention_only: e.target.checked }))} />
            Attention only
          </label>

          <div className="ml-auto flex gap-2">
            <Button type="button" onClick={apply}>Apply filters</Button>
            <Button type="button" variant="secondary" onClick={clearAll}>Clear</Button>
          </div>
        </div>
      </div>

      {loading && <SkeletonTable rows={5} cols={6} />}
      <ErrorMessage error={error} />
      {data && data.items.length === 0 && <EmptyState>No pairs match these filters.</EmptyState>}
      {data && data.items.length > 0 && (
        <>
          <Table head={["Trainee", "Plan", "Due", "Status", "Last activity", "Source", "Flags"]}>
            {data.items.map((r) => (
              <Row key={`${r.trainee_id}-${r.plan_id}`} className={r.needs_attention ? "bg-accent/5" : ""}>
                <td className="px-4 py-3">
                  <div className="font-medium text-ink">{r.trainee_name}</div>
                  <div className="kicker">{r.trainee_email}</div>
                </td>
                <td className="px-4 py-3 text-ink">{r.plan_title}</td>
                <td className="px-4 py-3 tnum text-muted">{formatDate(r.due_date)}</td>
                <td className="px-4 py-3"><StatusBadge status={r.latest_status} /></td>
                <td className="px-4 py-3 tnum whitespace-nowrap text-muted">{r.last_report_at ? formatDateTime(r.last_report_at) : "—"}</td>
                <td className="px-4 py-3 text-muted">{r.source}</td>
                <td className="px-4 py-3 text-xs"><Flags r={r} /></td>
              </Row>
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
  if (r.is_overdue) flags.push(["Overdue", "var(--overdue-fg)"]);
  if (r.is_missing) flags.push(["Missing", "var(--missing-fg)"]);
  if (r.latest_status === "blocked") flags.push(["Blocked", "var(--blocked-fg)"]);
  if (flags.length === 0) return <span className="text-muted">—</span>;
  return (
    <span className="flex flex-wrap gap-1">
      {flags.map(([label, color]) => (
        <span key={label} className="font-medium" style={{ color }}>{label}</span>
      ))}
    </span>
  );
}

function PickerWithClear({ legend, name, load, getLabel, selectedId, onSelect }) {
  return (
    <div className="space-y-1">
      <PaginatedPicker legend={legend} name={name} load={load} getId={(x) => x.id} getLabel={getLabel} selectedId={selectedId} onSelect={onSelect} />
      {selectedId && (
        <button type="button" className="text-xs text-accent hover:underline" onClick={() => onSelect(null)}>
          Clear selection
        </button>
      )}
    </div>
  );
}
