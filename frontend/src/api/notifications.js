import { api } from "./client";

// Response includes unread_count alongside the paginated items.
export const listNotifications = (unreadOnly = false, limit = 50, offset = 0) =>
  api.get(`/notifications?unread_only=${unreadOnly}&limit=${limit}&offset=${offset}`);

export const markRead = (id) => api.patch(`/notifications/${id}/read`);
