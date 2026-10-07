import { api } from "./client";

// Returns { trainee, temporary_password } -- the password is shown only once.
export const onboardTrainee = (name, email) => api.post("/trainees", { name, email });

// Optional filters power the "only offer what's available" pickers:
//   notInCohort     -> only active trainees NOT already in that cohort
//   notAssignedPlan -> only active trainees NOT already directly assigned that plan
//   q               -> name/email contains-search
export const listTrainees = (limit = 50, offset = 0, { notInCohort, notAssignedPlan, q } = {}) => {
  const params = new URLSearchParams({ limit, offset });
  if (notInCohort) params.set("not_in_cohort", notInCohort);
  if (notAssignedPlan) params.set("not_assigned_plan", notAssignedPlan);
  if (q) params.set("q", q);
  return api.get(`/trainees?${params.toString()}`);
};
