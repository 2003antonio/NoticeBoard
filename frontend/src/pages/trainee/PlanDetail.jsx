import { useState } from "react";
import { ArrowLeft, CheckCircle2 } from "lucide-react";
import { Link, useLocation, useParams } from "react-router-dom";

import { myPlans, myReports, submitReport } from "../../api/myplans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate, formatDateTime } from "../../lib/format";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import Table, { Row } from "../../components/Table";
import { useToast } from "../../components/Toast";

const PAGE = 10;

export default function TraineePlanDetail() {
  const { planId } = useParams();
  const location = useLocation();
  const passedPlan = location.state?.plan;
  const toast = useToast();

  // Reuse the plan handed over from the list; only fetch to find it on a direct
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

  // Latest status comes from the plan; a submission in this session wins, so the
  // form locks the instant a "done" is submitted (correct on first render, no flash).
  const [submittedStatus, setSubmittedStatus] = useState(null);
  const latestStatus = submittedStatus || plan?.latest_status || "no_report";
  const isDone = latestStatus === "done";

  const [offset, setOffset] = useState(0);
  const reportsLoad = useLoader(() => myReports(planId, PAGE, offset), [planId, offset]);

  const [status, setStatus] = useState("on_track");
  const [notes, setNotes] = useState("");
  const [formError, setFormError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setApiError(null);
    if (status === "blocked" && notes.trim() === "") {
      setFormError("Please say what is blocking you.");
      return;
    }
    setSubmitting(true);
    try {
      await submitReport(planId, status, notes.trim() || null);
      setSubmittedStatus(status);
      setNotes("");
      setStatus("on_track");
      setOffset(0);
      reportsLoad.reload();
      toast.show("Progress saved");
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
    <div className="space-y-8">
      <div className="space-y-2 border-b border-rule pb-5">
        <BackLink />
        <div className="kicker">Plan</div>
        <h1 className="font-display text-3xl font-semibold text-ink">{plan.title}</h1>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
          <span>Due {formatDate(plan.due_date)}</span>
          <span aria-hidden="true">·</span>
          <span>Source: {plan.source}</span>
          <span aria-hidden="true">·</span>
          <StatusBadge status={latestStatus} />
        </div>
        {plan.description && <p className="max-w-prose text-sm text-ink">{plan.description}</p>}
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">Submit a progress update</h2>
        {isDone ? (
          <Card className="flex items-center gap-3">
            <CheckCircle2 aria-hidden="true" className="h-5 w-5" style={{ color: "var(--done-fg)" }} />
            <p className="text-sm text-ink">
              This plan is marked <strong>done</strong>. No more updates can be submitted.
            </p>
          </Card>
        ) : (
          <Card>
            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <FormField label="Status" id="status">
                <select id="status" className={inputClass} value={status} onChange={(e) => setStatus(e.target.value)}>
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

              <Button type="submit" loading={submitting}>
                {submitting ? "Submitting..." : "Submit update"}
              </Button>
            </form>
          </Card>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">My update history</h2>
        {reportsLoad.loading && <Spinner />}
        <ErrorMessage error={reportsLoad.error} />
        {reportsLoad.data && reportsLoad.data.items.length === 0 && (
          <EmptyState>No updates submitted for this plan yet.</EmptyState>
        )}
        {reportsLoad.data && reportsLoad.data.items.length > 0 && (
          <>
            <Table head={["When", "Status", "Notes"]}>
              {reportsLoad.data.items.map((r) => (
                <Row key={r.id}>
                  <td className="px-4 py-3 tnum whitespace-nowrap text-muted">{formatDateTime(r.submitted_at)}</td>
                  <td className="px-4 py-3">
                    <StatusBadge status={r.status} />
                  </td>
                  <td className="px-4 py-3 text-ink">{r.notes || "—"}</td>
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

function BackLink() {
  return (
    <Link to="/my/plans" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
      <ArrowLeft className="h-3.5 w-3.5" /> Back to my plans
    </Link>
  );
}
