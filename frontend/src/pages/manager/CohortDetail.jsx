import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { addMember, getCohortPlans, listMembers } from "../../api/cohorts";
import { assignPlan, listPlans } from "../../api/plans";
import { listTrainees } from "../../api/trainees";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import AddPanel from "../../components/AddPanel";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import Table, { OpenHint, Row, RowLink, StretchedLink } from "../../components/Table";
import { useToast } from "../../components/Toast";

const PAGE = 20;

export default function CohortDetail() {
  const { cohortId } = useParams();
  const toast = useToast();

  // Bumped after a successful add so both loaders refetch deterministically
  // (more reliable than calling reload() across the AddPanel callback boundary).
  const [reloadKey, setReloadKey] = useState(0);
  const members = useLoader(() => listMembers(cohortId), [cohortId, reloadKey]);

  const [planOffset, setPlanOffset] = useState(0);
  const plans = useLoader(() => getCohortPlans(cohortId, PAGE, planOffset), [cohortId, planOffset, reloadKey]);

  return (
    <div className="space-y-10">
      <div className="space-y-2 border-b border-rule pb-5">
        <Link to="/cohorts" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to cohorts
        </Link>
        <div className="kicker">Cohort</div>
        <h1 className="font-display text-3xl font-semibold text-ink">Cohort detail</h1>
      </div>

      {/* --- Members --- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink">Members in this cohort</h2>
          <AddPanel
            buttonLabel="Add trainee"
            title="Add a trainee"
            confirmLabel="Add to cohort"
            name="add-member"
            load={(limit, offset, q) => listTrainees(limit, offset, { notInCohort: cohortId, q })}
            getId={(t) => t.id}
            getLabel={(t) => `${t.name} — ${t.email}`}
            emptyMessage="Everyone is already in this cohort."
            onConfirm={async (traineeId) => {
              await addMember(cohortId, traineeId);
              toast.show("Trainee added to cohort");
              setReloadKey((k) => k + 1);
            }}
          />
        </div>

        {members.loading && <Spinner />}
        <ErrorMessage error={members.error} />
        {members.data && members.data.items.length === 0 && (
          <EmptyState>This cohort has no members yet. Use “Add trainee” to add some.</EmptyState>
        )}
        {members.data && members.data.items.length > 0 && (
          <Table head={["Name", "Email", "Status", "Added"]}>
            {members.data.items.map((m) => (
              <Row key={m.id}>
                <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                <td className="px-4 py-3 text-muted">{m.email}</td>
                <td className="px-4 py-3">
                  {m.active ? (
                    <span style={{ color: "var(--done-fg)" }}>Active</span>
                  ) : (
                    <span className="text-muted">Deactivated</span>
                  )}
                </td>
                <td className="px-4 py-3 tnum text-muted">{formatDate(m.added_at)}</td>
              </Row>
            ))}
          </Table>
        )}
      </section>

      {/* --- Plans assigned to this cohort --- */}
      <section className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-display text-xl font-semibold text-ink">Plans for this cohort</h2>
          <AddPanel
            buttonLabel="Add plan"
            title="Assign a plan to this cohort"
            confirmLabel="Assign plan"
            name="add-plan"
            load={(limit, offset, q) => listPlans(limit, offset, { notAssignedCohort: cohortId, q })}
            getId={(p) => p.id}
            getLabel={(p) => p.title}
            emptyMessage={
              <>
                No unassigned plans left.{" "}
                <Link to="/plans" className="text-accent hover:underline">Create one on the Plans page.</Link>
              </>
            }
            onConfirm={async (planId) => {
              // Reuses the existing assignment action, so every active member is notified.
              const result = await assignPlan(planId, { cohort_id: cohortId });
              toast.show(`Assigned — notified ${result.notified} ${result.notified === 1 ? "person" : "people"}`);
              setPlanOffset(0);
              setReloadKey((k) => k + 1);
            }}
          />
        </div>

        {plans.loading && <Spinner />}
        <ErrorMessage error={plans.error} />
        {plans.data && plans.data.items.length === 0 && (
          <EmptyState>No plans assigned to this cohort yet. Use “Add plan” to assign one.</EmptyState>
        )}
        {plans.data && plans.data.items.length > 0 && (
          <>
            <Table head={["Plan", "Due date", "Assigned", "Reach", ""]}>
              {plans.data.items.map((p) => (
                <RowLink key={p.id} to={`/plans/${p.id}`}>
                  <td className="px-4 py-3">
                    <StretchedLink to={`/plans/${p.id}`}>{p.title}</StretchedLink>
                  </td>
                  <td className="px-4 py-3 tnum text-muted">{formatDate(p.due_date)}</td>
                  <td className="px-4 py-3 tnum text-muted">{formatDateTime(p.assigned_at)}</td>
                  <td className="px-4 py-3 tnum text-muted">
                    {p.active_member_count} {p.active_member_count === 1 ? "member gets" : "members get"} this
                  </td>
                  <td className="px-4 py-3 text-right"><OpenHint /></td>
                </RowLink>
              ))}
            </Table>
            <Pagination total={plans.data.total} limit={PAGE} offset={planOffset} onChange={setPlanOffset} />
          </>
        )}
      </section>
    </div>
  );
}
