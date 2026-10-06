import { useState } from "react";
import { Link, useParams } from "react-router-dom";

import { addMember, listMembers } from "../../api/cohorts";
import { listTrainees } from "../../api/trainees";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PaginatedPicker from "../../components/PaginatedPicker";
import Spinner from "../../components/Spinner";
import Table from "../../components/Table";

export default function CohortDetail() {
  const { cohortId } = useParams();
  const members = useLoader(() => listMembers(cohortId), [cohortId]);

  const [traineeId, setTraineeId] = useState(null);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleAdd(e) {
    e.preventDefault();
    setError(null);
    if (!traineeId) {
      setError({ message: "Pick a trainee to add." });
      return;
    }
    setSubmitting(true);
    try {
      await addMember(cohortId, traineeId);
      setTraineeId(null);
      members.reload();
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <Link to="/cohorts" className="text-sm text-blue-600 hover:underline">
          ← Back to cohorts
        </Link>
        <h1 className="text-xl font-semibold text-slate-800">Cohort members</h1>
      </div>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-800">Add a trainee</h2>
        <form onSubmit={handleAdd} className="space-y-3" noValidate>
          <PaginatedPicker
            legend="Choose a trainee"
            name="add-member"
            load={listTrainees}
            getId={(t) => t.id}
            getLabel={(t) => `${t.name} — ${t.email}${t.active ? "" : " (deactivated)"}`}
            selectedId={traineeId}
            onSelect={setTraineeId}
          />
          <ErrorMessage error={error} />
          <Button type="submit" disabled={submitting}>
            {submitting ? "Adding..." : "Add to cohort"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h2 className="font-semibold text-slate-800">Members</h2>
        {members.loading && <Spinner />}
        <ErrorMessage error={members.error} />
        {members.data && members.data.items.length === 0 && (
          <EmptyState>This cohort has no members yet.</EmptyState>
        )}
        {members.data && members.data.items.length > 0 && (
          <Table head={["Name", "Email", "Status", "Added"]}>
            {members.data.items.map((m) => (
              <tr key={m.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{m.name}</td>
                <td className="px-4 py-2 text-slate-600">{m.email}</td>
                <td className="px-4 py-2">
                  {m.active ? (
                    <span className="text-green-700">Active</span>
                  ) : (
                    <span className="text-slate-500">Deactivated</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">{formatDate(m.added_at)}</td>
              </tr>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
