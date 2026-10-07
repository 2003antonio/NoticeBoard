import { api } from "./client";

// notAssignedCohort -> only plans NOT already assigned to that cohort; q -> title search.
export const listPlans = (limit = 50, offset = 0, { notAssignedCohort, q } = {}) => {
  const params = new URLSearchParams({ limit, offset });
  if (notAssignedCohort) params.set("not_assigned_cohort", notAssignedCohort);
  if (q) params.set("q", q);
  return api.get(`/plans?${params.toString()}`);
};

export const getPlan = (planId) => api.get(`/plans/${planId}`);

export const createPlan = (body) => api.post("/plans", body); // { title, description?, due_date? }

// body is exactly one of { cohort_id } or { trainee_id }. Response has `notified`.
export const assignPlan = (planId, body) => api.post(`/plans/${planId}/assignments`, body);

// Who the plan is assigned to: { cohorts:{items,total}, trainees:{items,total}, limit, offset }.
export const getPlanAssignments = (planId, limit = 50, offset = 0) =>
  api.get(`/plans/${planId}/assignments?limit=${limit}&offset=${offset}`);

export const listPlanReports = (planId, limit = 50, offset = 0) =>
  api.get(`/plans/${planId}/reports?limit=${limit}&offset=${offset}`);
