import { api } from "./client";

// notAssignedPlan -> only cohorts NOT already assigned that plan; q -> name search.
export const listCohorts = (limit = 50, offset = 0, { notAssignedPlan, q } = {}) => {
  const params = new URLSearchParams({ limit, offset });
  if (notAssignedPlan) params.set("not_assigned_plan", notAssignedPlan);
  if (q) params.set("q", q);
  return api.get(`/cohorts?${params.toString()}`);
};

export const createCohort = (name) => api.post("/cohorts", { name });

export const listMembers = (cohortId) => api.get(`/cohorts/${cohortId}/members`);

// Adds a trainee and returns the updated member list.
export const addMember = (cohortId, traineeId) =>
  api.post(`/cohorts/${cohortId}/members`, { trainee_id: traineeId });

// Plans assigned to this cohort (manager only). Rows carry active_member_count.
export const getCohortPlans = (cohortId, limit = 50, offset = 0) =>
  api.get(`/cohorts/${cohortId}/plans?limit=${limit}&offset=${offset}`);
