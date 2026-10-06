import { NavLink, Outlet } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { NAV_BY_ROLE } from "../lib/roles";
import Button from "./Button";
import NotificationBell from "./NotificationBell";

// The frame around every signed-in page: a header with role-appropriate nav,
// the notification bell, and logout. <Outlet/> renders the current page.
export default function AppShell() {
  const { user, logout } = useAuth();
  const links = NAV_BY_ROLE[user.role] || [];

  return (
    <div className="min-h-screen">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-x-4 gap-y-2 px-4 py-3">
          <span className="font-semibold text-slate-800">NoticeBoardTracker</span>
          <nav className="flex flex-1 flex-wrap gap-1">
            {links.map((link) => (
              <NavLink
                key={link.to}
                to={link.to}
                className={({ isActive }) =>
                  "rounded-md px-3 py-1.5 text-sm " +
                  (isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100")
                }
              >
                {link.label}
              </NavLink>
            ))}
          </nav>
          <NotificationBell />
          <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>
          <Button variant="secondary" onClick={logout}>
            Log out
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-6">
        <Outlet />
      </main>
    </div>
  );
}
