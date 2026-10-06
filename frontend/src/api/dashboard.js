import { api } from "./client";

export const summary = () => api.get("/dashboard/summary");

export const cohortRows = (limit = 50, offset = 0) =>
  api.get(`/dashboard/cohorts?limit=${limit}&offset=${offset}`);

// filters: { cohort_id, plan_id, trainee_id, attention_only, status }
export const traineeRows = (filters = {}, limit = 50, offset = 0) => {
  const params = new URLSearchParams({ limit, offset });
  for (const [key, value] of Object.entries(filters)) {
    // Only send filters that are actually set, so empty pickers mean "no filter".
    if (value !== undefined && value !== null && value !== "" && value !== false) {
      params.set(key, value);
    }
  }
  return api.get(`/dashboard/trainees?${params.toString()}`);
};
