import { useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { homePath } from "../lib/roles";
import Button from "../components/Button";
import FormField, { inputClass } from "../components/FormField";

export default function Login() {
  const { user, login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  // Already logged in? Skip the form.
  if (user) return <Navigate to={homePath(user.role)} replace />;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const loggedIn = await login(email, password);
      const dest = location.state?.from || homePath(loggedIn.role);
      navigate(dest, { replace: true });
    } catch (err) {
      // A 401 on the login request specifically means bad credentials (the
      // request carried no token), so we show that rather than a generic error.
      setError(err.status === 401 ? "Wrong email or password." : err.message);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">NoticeBoardTracker</h1>
        <p className="mb-5 text-sm text-slate-500">Sign in to continue.</p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
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
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Signing in..." : "Sign in"}
          </Button>
        </form>
      </div>
    </div>
  );
}
