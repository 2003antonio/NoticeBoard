import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { getPlan, listPlanReports } from "../../api/plans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import Table from "../../components/Table";
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
    <div className="space-y-6">
      <div className="space-y-1">
        <Back />
        <h1 className="text-xl font-semibold text-slate-800">{plan.title}</h1>
        <p className="text-sm text-slate-500">Due {formatDate(plan.due_date)}</p>
        {plan.description && <p className="text-sm text-slate-700">{plan.description}</p>}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-800">Assign this plan</h2>
        {/* Reload the reports after an assignment so new recipients show up. */}
        <AssignForm planId={planId} onAssigned={() => { setOffset(0); reportsLoad.reload(); }} />
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">Progress reports</h2>
        {reportsLoad.loading && <Spinner />}
        <ErrorMessage error={reportsLoad.error} />
        {reportsLoad.data && reportsLoad.data.items.length === 0 && (
          <EmptyState>No reports submitted for this plan yet.</EmptyState>
        )}
        {reportsLoad.data && reportsLoad.data.items.length > 0 && (
          <>
            <Table head={["Trainee", "Status", "Notes", "When"]}>
              {reportsLoad.data.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2">
                    <div className="font-medium text-slate-800">{r.trainee_name}</div>
                    <div className="text-xs text-slate-500">{r.trainee_email}</div>
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-700">{r.notes || "—"}</td>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                    {formatDateTime(r.submitted_at)}
                  </td>
                </tr>
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
    <Link to="/plans" className="text-sm text-blue-600 hover:underline">
      ← Back to plans
    </Link>
  );
}
