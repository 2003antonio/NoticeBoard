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

      <p className="text-xs text-muted">Pick exactly one: a cohort or a single trainee.</p>

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
