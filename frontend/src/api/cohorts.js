import { api } from "./client";

export const listCohorts = (limit = 50, offset = 0) =>
  api.get(`/cohorts?limit=${limit}&offset=${offset}`);

export const createCohort = (name) => api.post("/cohorts", { name });

export const listMembers = (cohortId) => api.get(`/cohorts/${cohortId}/members`);

// Adds a trainee and returns the updated member list.
export const addMember = (cohortId, traineeId) =>
  api.post(`/cohorts/${cohortId}/members`, { trainee_id: traineeId });
