import { api } from "./client";

// Not paginated: a single trainee's plan list is naturally small.
export const myPlans = () => api.get("/my/plans");

export const myReports = (planId, limit = 50, offset = 0) =>
  api.get(`/my/plans/${planId}/reports?limit=${limit}&offset=${offset}`);

// status is on_track | blocked | done; blocked requires notes.
export const submitReport = (planId, status, notes) =>
  api.post(`/my/plans/${planId}/reports`, { status, notes });
