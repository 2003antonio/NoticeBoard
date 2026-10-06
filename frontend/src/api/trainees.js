import { api } from "./client";

// Returns { trainee, temporary_password } -- the password is shown only once.
export const onboardTrainee = (name, email) => api.post("/trainees", { name, email });

export const listTrainees = (limit = 50, offset = 0) =>
  api.get(`/trainees?limit=${limit}&offset=${offset}`);
