import { api } from "./client";

export const login = (email, password) => api.post("/auth/login", { email, password });
export const me = () => api.get("/auth/me");
export const changePassword = (current_password, new_password) =>
  api.post("/auth/change-password", { current_password, new_password });
