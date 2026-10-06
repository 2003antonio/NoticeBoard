import { useState } from "react";

import { assignPlan } from "../../api/plans";
import { listCohorts } from "../../api/cohorts";
import { listTrainees } from "../../api/trainees";
import Button from "../../components/Button";
import ErrorMessage from "../../components/ErrorMessage";
import PaginatedPicker from "../../components/PaginatedPicker";

// Assign a plan to EITHER a cohort OR a single trainee. Both pickers are shown;
// we enforce "exactly one" on submit, mirroring the backend's rule. The pickers
// page through the server, so a large org never loads every cohort or trainee.
export default function AssignForm({ planId, onAssigned }) {
  const [cohortId, setCohortId] = useState(null);
  const [traineeId, setTraineeId] = useState(null);
  const [formError, setFormError] = useState(null);
  const [apiError, setApiError] = useState(null);
  const [notified, setNotified] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError(null);
    setApiError(null);
    setNotified(null);

    // Exactly one target. Both or neither is a mistake we catch before calling.
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
      setNotified(result.notified);
      setCohortId(null);
      setTraineeId(null);
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
          legend="Assign to a cohort"
          name="assign-cohort"
          load={listCohorts}
          getId={(c) => c.id}
          getLabel={(c) => `${c.name} (${c.member_count} members)`}
          selectedId={cohortId}
          onSelect={setCohortId}
        />
        <PaginatedPicker
          legend="…or a single trainee"
          name="assign-trainee"
          load={listTrainees}
          getId={(t) => t.id}
          getLabel={(t) => `${t.name} — ${t.email}`}
          selectedId={traineeId}
          onSelect={setTraineeId}
        />
      </div>

      <p className="text-xs text-slate-500">Pick exactly one: a cohort or a single trainee.</p>

      {formError && (
        <p role="alert" className="text-sm text-red-700">
          {formError}
        </p>
      )}
      <ErrorMessage error={apiError} />

      {notified !== null && (
        <p className="rounded-md bg-green-50 px-4 py-2 text-sm text-green-800">
          Assigned. Notified {notified} {notified === 1 ? "person" : "people"}.
        </p>
      )}

      <Button type="submit" disabled={submitting}>
        {submitting ? "Assigning..." : "Assign plan"}
      </Button>
    </form>
  );
}
