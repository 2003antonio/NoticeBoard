// Where each role lands after login, and which nav links they see. The backend
// is the real guard; this only decides convenience (landing page, hidden links).
export function homePath(role) {
  if (role === "manager") return "/dashboard";
  if (role === "hr") return "/trainees";
  return "/my/plans"; // trainee
}

// Nav links per role, in display order.
export const NAV_BY_ROLE = {
  trainee: [
    { to: "/my/plans", label: "My plans" },
    { to: "/notifications", label: "Notifications" },
  ],
  hr: [
    { to: "/trainees", label: "Trainees" },
    { to: "/onboard", label: "Onboard trainee" },
    { to: "/notifications", label: "Notifications" },
  ],
  manager: [
    { to: "/dashboard", label: "Dashboard" },
    { to: "/plans", label: "Plans" },
    { to: "/cohorts", label: "Cohorts" },
    { to: "/notifications", label: "Notifications" },
  ],
};
