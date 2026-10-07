import { useState } from "react";

import { assignPlan } from "../../api/plans";
import { listCohorts } from "../../api/cohorts";
import { listTrainees } from "../../api/trainees";
import Button from "../../components/Button";
import ErrorMessage from "../../components/ErrorMessage";
import PaginatedPicker from "../../components/PaginatedPicker";
import { useToast } from "../../components/Toast";

// Assign a plan to EITHER a cohort OR a single trainee. Both pickers are shown;
// we enforce "exactly one" on submit, mirroring the backend. The pickers page
// through the server, so a large org never loads every cohort or trainee.
export default function AssignForm({ planId, onAssigned }) {
  const toast = useToast();
  const [cohortId, setCohortId] = useState(null);
  const [traineeId, setTraineeId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // Bumped after each successful assign to remount the pickers so they re-fetch
  // the now-smaller "not yet assigned" lists (the just-assigned target drops off).
  const [resetKey, setResetKey] = useState(0);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setApiError(null);

    if (cohortId && traineeId) {
      setFormError("Choose a cohort OR a trainee, not both.");
      return;
    }
    if (!cohortId && !traineeId) {
      setFormError("Choose a cohort or a trainee to assign this plan to.");
      return;
    }

    setSubmitting(true);
    try {
      const body = cohortId ? { cohort_id: cohortId } : { trainee_id: traineeId };
      const result = await assignPlan(planId, body);
      setCohortId(null);
      setTraineeId(null);
      setResetKey((k) => k + 1); // refresh the pickers
      toast.show(`Assigned — notified ${result.notified} ${result.notified === 1 ? "person" : "people"}`);
      if (onAssigned) onAssigned();
    } catch (err) {
      setApiError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <PaginatedPicker
          key={`cohort-${resetKey}`}
          legend="Assign to a cohort"
          name="assign-cohort"
          // Only cohorts that don't already have this plan.
          load={(limit, offset, q) => listCohorts(limit, offset, { notAssignedPlan: planId, q })}
          getId={(c) => c.id}
          getLabel={(c) => `${c.name} (${c.member_count} ${c.member_count === 1 ? "member" : "members"})`}
          selectedId={cohortId}
          onSelect={setCohortId}
          emptyMessage="Every cohort already has this plan."
        />
        <PaginatedPicker
          key={`trainee-${resetKey}`}
          legend="…or a single trainee"
          name="assign-trainee"
          // Only active trainees not already assigned this plan directly.
          load={(limit, offset, q) => listTrainees(limit, offset, { notAssignedPlan: planId, q })}
          getId={(t) => t.id}
          getLabel={(t) => `${t.name} — ${t.email}`}
          selectedId={traineeId}
          onSelect={setTraineeId}
          emptyMessage="No trainees left to assign directly."
        />
      </div>

      <p className="text-xs text-muted">
        Pick exactly one: a cohort or a single trainee. A trainee already in an assigned cohort
        still receives this plan — assign directly only if you also want it outside that cohort.
      </p>

      {formError && (
        <p role="alert" className="text-sm font-medium" style={{ color: "var(--blocked-fg)" }}>
          {formError}
        </p>
      )}
      <ErrorMessage error={apiError} />

      <Button type="submit" loading={submitting}>
        {submitting ? "Assigning..." : "Assign plan"}
      </Button>
    </form>
  );
}
