import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { homePath } from "../lib/roles";
import Button from "../components/Button";
import ErrorMessage from "../components/ErrorMessage";
import FormField, { inputClass } from "../components/FormField";

// Used both for the forced first-login change and for a voluntary change.
export default function ChangePassword() {
  const { user, changePassword } = useAuth();
  const navigate = useNavigate();

  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState(null);
  const [localError, setLocalError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  const forced = user.must_change_password;

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setLocalError(null);

    // Friendly browser-side check before we bother the server.
    if (next !== confirm) {
      setLocalError("The new passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await changePassword(current, next);
      // The flag is cleared now; go to the role's home.
      navigate(homePath(user.role), { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-sm rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="mb-1 text-xl font-semibold text-slate-800">Set a new password</h1>
        <p className="mb-5 text-sm text-slate-500">
          {forced
            ? "Your account uses a temporary password. Choose a new one to continue."
            : "Update the password for your account."}
        </p>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label={forced ? "Temporary password" : "Current password"} id="current">
            <input
              id="current"
              type="password"
              autoComplete="current-password"
              required
              className={inputClass}
              value={current}
              onChange={(e) => setCurrent(e.target.value)}
            />
          </FormField>

          <FormField label="New password" id="new" error={error?.fieldError?.("new_password")}>
            <input
              id="new"
              type="password"
              autoComplete="new-password"
              required
              maxLength={128}
              className={inputClass}
              value={next}
              onChange={(e) => setNext(e.target.value)}
            />
          </FormField>

          <FormField label="Confirm new password" id="confirm" error={localError}>
            <input
              id="confirm"
              type="password"
              autoComplete="new-password"
              required
              className={inputClass}
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </FormField>

          <ErrorMessage error={error} />

          <Button type="submit" disabled={submitting} className="w-full">
            {submitting ? "Saving..." : "Save new password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
