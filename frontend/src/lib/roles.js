import {
  LayoutDashboard,
  ClipboardList,
  Users,
  UserPlus,
  Bell,
  BookOpen,
} from "lucide-react";

// Where each role lands after login, and which nav links they see. The backend
// is the real guard; this only decides convenience (landing page, hidden links).
export function homePath(role) {
  if (role === "manager") return "/dashboard";
  if (role === "hr") return "/trainees";
  return "/my/plans"; // trainee
}

// Nav links per role, in display order, each with an icon for the masthead.
export const NAV_BY_ROLE = {
  trainee: [
    { to: "/my/plans", label: "My plans", icon: BookOpen },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  hr: [
    { to: "/trainees", label: "Trainees", icon: Users },
    { to: "/onboard", label: "Onboard", icon: UserPlus },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
  manager: [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/plans", label: "Plans", icon: ClipboardList },
    { to: "/cohorts", label: "Cohorts", icon: Users },
    { to: "/notifications", label: "Notifications", icon: Bell },
  ],
};

// Human label for the current role, shown by the user's name.
export const ROLE_LABEL = { trainee: "Trainee", hr: "HR", manager: "Manager" };

// Longest-prefix match so the top bar can title the current page.
const TITLES = [
  ["/dashboard", "Dashboard"],
  ["/plans", "Plans"],
  ["/cohorts", "Cohorts"],
  ["/trainees", "Trainees"],
  ["/onboard", "Onboard trainee"],
  ["/my/plans", "My plans"],
  ["/notifications", "Notifications"],
];

export function titleForPath(pathname) {
  const hit = TITLES.filter(([p]) => pathname === p || pathname.startsWith(p + "/")).sort(
    (a, b) => b[0].length - a[0].length
  )[0];
  return hit ? hit[1] : "NoticeBoardTracker";
}
