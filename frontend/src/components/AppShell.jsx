import { useEffect, useState } from "react";
import { Menu, X } from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { NAV_BY_ROLE, ROLE_LABEL } from "../lib/roles";
import Button from "./Button";
import NotificationBell from "./NotificationBell";
import ThemeToggle from "./ThemeToggle";

// The frame around every signed-in page, styled like a journal's nameplate:
// the title in the serif face, a role-coloured rule, then a row of mono nav
// labels. The role accent is applied to <html data-role> so the whole app
// (nav highlight, rule, primary buttons) reflects who is signed in; it is
// removed on logout so the login page falls back to the neutral accent.
export default function AppShell() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const links = NAV_BY_ROLE[user.role] || [];

  useEffect(() => {
    document.documentElement.setAttribute("data-role", user.role);
    return () => document.documentElement.removeAttribute("data-role");
  }, [user.role]);

  // Close the mobile drawer whenever the route changes.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const navLinkClass = ({ isActive }) =>
    "flex items-center gap-2 rounded-md px-3 py-1.5 text-sm transition-colors " +
    (isActive ? "bg-accent/10 font-medium text-accent" : "text-muted hover:text-ink");

  return (
    <div className="min-h-screen">
      <header className="border-b-2 border-accent bg-paper">
        <div className="mx-auto max-w-5xl px-4">
          {/* Nameplate row */}
          <div className="flex items-center justify-between gap-4 py-3">
            <span className="font-display text-xl font-semibold tracking-tight text-ink">
              NoticeBoardTracker
            </span>
            <div className="flex items-center gap-2">
              <NotificationBell />
              <ThemeToggle />
              <span className="hidden text-right text-sm sm:block">
                <span className="block leading-tight text-ink">{user.name}</span>
                <span className="kicker">{ROLE_LABEL[user.role]}</span>
              </span>
              <span className="hidden sm:block">
                <Button variant="secondary" onClick={logout}>
                  Log out
                </Button>
              </span>
              {/* Hamburger on phone width */}
              <button
                className="rounded-md border border-rule p-2 text-ink md:hidden"
                aria-label={drawerOpen ? "Close menu" : "Open menu"}
                aria-expanded={drawerOpen}
                onClick={() => setDrawerOpen((o) => !o)}
              >
                {drawerOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
              </button>
            </div>
          </div>

          {/* Desktop nav row */}
          <nav className="hidden gap-1 pb-2 md:flex">
            {links.map((link) => (
              <NavLink key={link.to} to={link.to} className={navLinkClass}>
                <link.icon aria-hidden="true" className="h-4 w-4" />
                {link.label}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Mobile drawer */}
        {drawerOpen && (
          <div className="border-t border-rule bg-surface px-4 py-3 md:hidden">
            <nav className="flex flex-col gap-1">
              {links.map((link) => (
                <NavLink key={link.to} to={link.to} className={navLinkClass}>
                  <link.icon aria-hidden="true" className="h-4 w-4" />
                  {link.label}
                </NavLink>
              ))}
            </nav>
            <div className="mt-3 flex items-center justify-between border-t border-rule pt-3">
              <span className="text-sm">
                <span className="block leading-tight text-ink">{user.name}</span>
                <span className="kicker">{ROLE_LABEL[user.role]}</span>
              </span>
              <Button variant="secondary" onClick={logout}>
                Log out
              </Button>
            </div>
          </div>
        )}
      </header>

      <main className="animate-fade-in mx-auto max-w-5xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}
