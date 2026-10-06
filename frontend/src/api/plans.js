import { api } from "./client";

export const listPlans = (limit = 50, offset = 0) =>
  api.get(`/plans?limit=${limit}&offset=${offset}`);

export const getPlan = (planId) => api.get(`/plans/${planId}`);

export const createPlan = (body) => api.post("/plans", body); // { title, description?, due_date? }

// body is exactly one of { cohort_id } or { trainee_id }. Response has `notified`.
export const assignPlan = (planId, body) => api.post(`/plans/${planId}/assignments`, body);

export const listPlanReports = (planId, limit = 50, offset = 0) =>
  api.get(`/plans/${planId}/reports?limit=${limit}&offset=${offset}`);
