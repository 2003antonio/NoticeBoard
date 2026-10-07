import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { homePath } from "../lib/roles";
import Button from "../components/Button";
import FormField, { inputClass } from "../components/FormField";
import ThemeToggle from "../components/ThemeToggle";

// Portfolio demo accounts, offered as click-to-fill so a visitor can get in fast.
const DEMO = [
  { role: "Manager", email: "admin@noticeboard.test", password: "admin123" },
  { role: "HR", email: "humanresource@noticeboard.test", password: "humanresource123" },
  { role: "Trainee", email: "user@noticeboard.test", password: "user123" },
];

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  if (user) return <Navigate to={homePath(user.role)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      navigate(location.state?.from || homePath(loggedIn.role), { replace: true });
    } catch (err) {
      // A 401 on login means bad credentials (no token was sent); anything else
      // is an unexpected failure we show verbatim.
      setError(err.status === 401 ? "Wrong email or password." : err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>

      <div className="mx-auto grid min-h-screen max-w-4xl items-center gap-10 px-6 py-12 md:grid-cols-2">
        {/* Editorial masthead side */}
        <div className="md:border-r md:border-rule md:pr-10">
          <p className="kicker mb-3">A training notice board</p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-tight text-ink">
            NoticeBoard<span className="text-accent">Tracker</span>
          </h1>
          <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted">
            Onboard trainees, assign training plans to cohorts, and follow who is on
            track and who needs attention — in one calm, shared record.
          </p>

          <div className="mt-8">
            <p className="kicker mb-2">Demo accounts</p>
            <div className="flex flex-col gap-2">
              {DEMO.map((d) => (
                <button
                  key={d.email}
                  type="button"
                  onClick={() => {
                    setEmail(d.email);
                    setPassword(d.password);
                    setError(null);
                  }}
                  className="flex items-center justify-between rounded-md border border-rule bg-surface px-3 py-2 text-left text-sm transition-colors hover:bg-paper"
                >
                  <span className="text-ink">{d.role}</span>
                  <span className="font-mono text-xs text-muted">{d.email}</span>
                </button>
              ))}
            </div>
            <p className="mt-2 text-xs text-muted">Click one to fill the form, then sign in.</p>
          </div>
        </div>

        {/* Sign-in form side */}
        <div>
          <h2 className="font-display text-2xl font-semibold text-ink">Sign in</h2>
          <form onSubmit={handleSubmit} className="mt-5 space-y-4" noValidate>
            <FormField label="Email" id="email">
              <input
                id="email"
                type="email"
                autoComplete="username"
                required
                className={inputClass}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </FormField>

            <FormField label="Password" id="password">
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className={inputClass}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </FormField>

            {error && (
              <p role="alert" className="text-sm font-medium" style={{ color: "var(--blocked-fg)" }}>
                {error}
              </p>
            )}

            <Button type="submit" loading={submitting} className="w-full">
              {submitting ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
