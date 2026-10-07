import { useState } from "react";
import { useNavigate } from "react-router-dom";

import { useAuth } from "../context/AuthContext";
import { homePath } from "../lib/roles";
import Button from "../components/Button";
import ErrorMessage from "../components/ErrorMessage";
import FormField, { inputClass } from "../components/FormField";
import ThemeToggle from "../components/ThemeToggle";

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
    if (next !== confirm) {
      setLocalError("The new passwords do not match.");
      return;
    }
    setSubmitting(true);
    try {
      await changePassword(current, next);
      navigate(homePath(user.role), { replace: true });
    } catch (err) {
      setError(err);
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-paper">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-6 py-12">
        <p className="kicker mb-2">Account</p>
        <h1 className="font-display text-3xl font-semibold text-ink">Set a new password</h1>
        <p className="mt-2 text-sm text-muted">
          {forced
            ? "Your account uses a temporary password. Choose a new one to continue."
            : "Update the password for your account."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4" noValidate>
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

          <Button type="submit" loading={submitting} className="w-full">
            {submitting ? "Saving..." : "Save new password"}
          </Button>
        </form>
      </div>
    </div>
  );
}
