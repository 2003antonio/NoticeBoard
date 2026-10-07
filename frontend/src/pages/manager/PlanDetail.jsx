import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { getPlan, listPlanReports } from "../../api/plans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import Table, { Row } from "../../components/Table";
import AssignForm from "./AssignForm";

const PAGE = 20;

export default function ManagerPlanDetail() {
  const { planId } = useParams();
  const planLoad = useLoader(() => getPlan(planId), [planId]);

  const [offset, setOffset] = useState(0);
  const reportsLoad = useLoader(() => listPlanReports(planId, PAGE, offset), [planId, offset]);

  if (planLoad.loading) return <Spinner />;
  if (planLoad.error) {
    return (
      <div className="space-y-4">
        <Back />
        <ErrorMessage error={planLoad.error} />
      </div>
    );
  }

  const plan = planLoad.data;

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-rule pb-5">
        <Back />
        <div className="kicker">Plan</div>
        <h1 className="font-display text-3xl font-semibold text-ink">{plan.title}</h1>
        <p className="text-sm text-muted">Due {formatDate(plan.due_date)}</p>
        {plan.description && <p className="max-w-prose text-sm text-ink">{plan.description}</p>}
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">Assign this plan</h2>
        <Card>
          <AssignForm planId={planId} onAssigned={() => { setOffset(0); reportsLoad.reload(); }} />
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Progress reports</h2>
        {reportsLoad.loading && <Spinner />}
        <ErrorMessage error={reportsLoad.error} />
        {reportsLoad.data && reportsLoad.data.items.length === 0 && (
          <EmptyState>No reports submitted for this plan yet.</EmptyState>
        )}
        {reportsLoad.data && reportsLoad.data.items.length > 0 && (
          <>
            <Table head={["Trainee", "Status", "Notes", "When"]}>
              {reportsLoad.data.items.map((r) => (
                <Row key={r.id}>
                  <td className="px-4 py-3">
                    <div className="font-medium text-ink">{r.trainee_name}</div>
                    <div className="kicker">{r.trainee_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-ink">{r.notes || "—"}</td>
                  <td className="px-4 py-3 tnum whitespace-nowrap text-muted">{formatDateTime(r.submitted_at)}</td>
                </Row>
              ))}
            </Table>
            <Pagination total={reportsLoad.data.total} limit={PAGE} offset={offset} onChange={setOffset} />
          </>
        )}
      </section>
    </div>
  );
}

function Back() {
  return (
    <Link to="/plans" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to plans
    </Link>
  );
}
