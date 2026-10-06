import { useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";

import { myPlans, myReports, submitReport } from "../../api/myplans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import Table from "../../components/Table";

const PAGE = 10;

export default function TraineePlanDetail() {
  const { planId } = useParams();
  const location = useLocation();
  const passedPlan = location.state?.plan; // came from the My plans list

  // Reuse the plan we were handed; only fetch the list to find it on a direct
  // visit or refresh (there is no GET /my/plans/{id} endpoint by design).
  const planLoad = useLoader(() => {
    if (passedPlan) return Promise.resolve(passedPlan);
    return myPlans().then((data) => {
      const found = data.items.find((p) => p.id === planId);
      if (!found) throw new Error("Plan not found, or it is not assigned to you.");
      return found;
    });
  }, [planId]);

  const plan = planLoad.data;

  // The latest status comes straight from the plan; once the trainee submits a
  // new one in this session we prefer that, so the form can lock the instant a
  // "done" is submitted. Deriving it (instead of using an effect) means the lock
  // is correct on the very first render, with no flash of an editable form.
  const [submittedStatus, setSubmittedStatus] = useState(null);
  const latestStatus = submittedStatus || plan?.latest_status || "no_report";
  const isDone = latestStatus === "done";

  // Report history (paginated).
  const [offset, setOffset] = useState(0);
  const reportsLoad = useLoader(() => myReports(planId, PAGE, offset), [planId, offset]);

  // Report form.
  const [status, setStatus] = useState("on_track");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setApiError(null);

    // Match the backend rule in the browser for a faster, friendlier message.
    if (status === "blocked" && notes.trim() === "") {
      setFormError("Please say what is blocking you.");
      return;
    }

    setSubmitting(true);
    try {
      await submitReport(planId, status, notes.trim() || null);
      setSubmittedStatus(status); // may now be "done", which locks the form
      setNotes("");
      setStatus("on_track");
      setOffset(0);
      reportsLoad.reload();
    } catch (err) {
      setApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  if (planLoad.loading) return <Spinner />;
  if (planLoad.error) {
    return (
      <div className="space-y-4">
        <BackLink />
        <ErrorMessage error={planLoad.error} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <BackLink />
        <h1 className="text-xl font-semibold text-slate-800">{plan.title}</h1>
        <p className="text-sm text-slate-500">
          Due {formatDate(plan.due_date)} · Source: {plan.source} ·{" "}
          <StatusBadge status={latestStatus || "no_report"} />
        </p>
        {plan.description && <p className="text-sm text-slate-700">{plan.description}</p>}
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-800">Submit a progress update</h2>

        {isDone ? (
          <p className="rounded-md bg-green-50 px-4 py-3 text-sm text-green-800">
            This plan is marked <strong>done</strong>. No more updates can be submitted.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            <FormField label="Status" id="status">
              <select
                id="status"
                className={inputClass}
                value={status}
                onChange={(e) => setStatus(e.target.value)}
              >
                <option value="on_track">On track</option>
                <option value="blocked">Blocked</option>
                <option value="done">Done (final)</option>
              </select>
            </FormField>

            <FormField
              label="Notes"
              id="notes"
              error={formError || apiError?.fieldError?.("notes")}
              hint={status === "blocked" ? "Required when blocked." : "Optional."}
            >
              <textarea
                id="notes"
                rows={3}
                maxLength={2000}
                className={inputClass}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </FormField>

            <ErrorMessage error={apiError && !apiError.details?.length ? apiError : null} />

            <Button type="submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit update"}
            </Button>
          </form>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">My update history</h2>
        {reportsLoad.loading && <Spinner />}
        <ErrorMessage error={reportsLoad.error} />
        {reportsLoad.data && reportsLoad.data.items.length === 0 && (
          <EmptyState>You have not submitted any updates for this plan yet.</EmptyState>
        )}
        {reportsLoad.data && reportsLoad.data.items.length > 0 && (
          <>
            <Table head={["When", "Status", "Notes"]}>
              {reportsLoad.data.items.map((r) => (
                <tr key={r.id}>
                  <td className="px-4 py-2 whitespace-nowrap text-slate-600">
                    {formatDateTime(r.submitted_at)}
                  </td>
                  <td className="px-4 py-2">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-2 text-slate-700">{r.notes || "—"}</td>
                </tr>
              ))}
            </Table>
            <Pagination
              total={reportsLoad.data.total}
              limit={PAGE}
              offset={offset}
              onChange={setOffset}
            />
          </>
        )}
      </section>
    </div>
  );
}

function BackLink() {
  return (
    <Link to="/my/plans" className="text-sm text-blue-600 hover:underline">
      ← Back to my plans
    </Link>
  );
}
