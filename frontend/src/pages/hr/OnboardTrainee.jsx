import { useState } from "react";
import { AlertTriangle, Copy, UserPlus } from "lucide-react";

import { onboardTrainee } from "../../api/trainees";
import Button from "../../components/Button";
import Card from "../../components/Card";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import PageHeader from "../../components/PageHeader";
import { useToast } from "../../components/Toast";

export default function OnboardTrainee() {
  const toast = useToast();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // The one-time result, held only in this component's state and dropped the
  // moment the user resets -- never stored or logged.
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      setResult(await onboardTrainee(name.trim(), email.trim()));
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  function reset() {
    setResult(null);
    setName("");
    setEmail("");
    setCopied(false);
  }

  async function copyPassword() {
    try {
      await navigator.clipboard.writeText(result.temporary_password);
      setCopied(true);
      toast.show("Password copied");
    } catch {
      setCopied(false); // clipboard may be blocked; the password is visible anyway
    }
  }

  if (result) {
    return (
      <div className="max-w-xl space-y-6">
        <PageHeader kicker="HR" title="Trainee onboarded" />

        {/* Unmistakable warning style: this password is shown exactly once. */}
        <div
          className="rounded-lg border-2 p-5"
          style={{ borderColor: "var(--overdue-fg)", backgroundColor: "var(--overdue-bg)" }}
        >
          <div className="flex items-center gap-2" style={{ color: "var(--overdue-fg)" }}>
            <AlertTriangle aria-hidden="true" className="h-5 w-5" />
            <h2 className="font-display text-lg font-semibold">Copy the temporary password now</h2>
          </div>
          <p className="mt-2 text-sm text-ink">
            <strong>{result.trainee.name}</strong> ({result.trainee.email}) was created. This password
            will not be shown again — share it securely so they can sign in and set their own.
          </p>
          <div className="mt-3 flex items-center gap-2">
            <code className="flex-1 rounded border border-rule bg-surface px-3 py-2 font-mono text-sm text-ink">
              {result.temporary_password}
            </code>
            <Button variant="secondary" onClick={copyPassword}>
              <Copy className="h-4 w-4" /> {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>

        <Button onClick={reset}>Onboard another trainee</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-6">
      <PageHeader kicker="HR" title="Onboard a trainee" lead="Create an account and hand over a one-time password." />
      <Card>
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <FormField label="Full name" id="name" error={error?.fieldError?.("name")}>
            <input id="name" required maxLength={100} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
          </FormField>

          <FormField label="Email" id="email" error={error?.fieldError?.("email")}>
            <input id="email" type="email" required maxLength={254} className={inputClass} value={email} onChange={(e) => setEmail(e.target.value)} />
          </FormField>

          <ErrorMessage error={error && !error.details?.length ? error : null} />

          <Button type="submit" loading={submitting}>
            <UserPlus className="h-4 w-4" /> {submitting ? "Creating..." : "Create trainee"}
          </Button>
        </form>
      </Card>
    </div>
  );
}
