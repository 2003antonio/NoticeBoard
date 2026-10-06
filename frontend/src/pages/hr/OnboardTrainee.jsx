import { useState } from "react";

import { onboardTrainee } from "../../api/trainees";
import Button from "../../components/Button";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";

export default function OnboardTrainee() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  // The one-time result. Held only in this component's state and dropped the
  // moment the user resets or navigates away -- never stored or logged.
  const [result, setResult] = useState(null);
  const [copied, setCopied] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const data = await onboardTrainee(name.trim(), email.trim());
      setResult(data);
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
    } catch {
      setCopied(false); // clipboard may be blocked; the password is visible anyway
    }
  }

  if (result) {
    return (
      <div className="max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-slate-800">Trainee onboarded</h1>
        <div className="rounded-lg border border-amber-300 bg-amber-50 p-5">
          <p className="text-sm text-amber-900">
            <strong>{result.trainee.name}</strong> ({result.trainee.email}) was created.
          </p>
          <p className="mt-3 text-sm font-medium text-amber-900">
            Temporary password — copy it now. It will not be shown again.
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 rounded border border-amber-300 bg-white px-3 py-2 font-mono text-sm">
              {result.temporary_password}
            </code>
            <Button variant="secondary" onClick={copyPassword}>
              {copied ? "Copied" : "Copy"}
            </Button>
          </div>
        </div>
        <Button onClick={reset}>Onboard another trainee</Button>
      </div>
    );
  }

  return (
    <div className="max-w-md space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Onboard a trainee</h1>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <FormField label="Full name" id="name" error={error?.fieldError?.("name")}>
          <input
            id="name"
            required
            maxLength={100}
            className={inputClass}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </FormField>

        <FormField label="Email" id="email" error={error?.fieldError?.("email")}>
          <input
            id="email"
            type="email"
            required
            maxLength={254}
            className={inputClass}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </FormField>

        {/* Show non-field errors (e.g. 409 duplicate email) too. */}
        <ErrorMessage error={error && !error.details?.length ? error : null} />

        <Button type="submit" disabled={submitting}>
          {submitting ? "Creating..." : "Create trainee"}
        </Button>
      </form>
    </div>
  );
}
