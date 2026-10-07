import { useState } from "react";
import { ArrowLeft } from "lucide-react";
import { Link, useParams } from "react-router-dom";

import { addMember, listMembers } from "../../api/cohorts";
import { listTrainees } from "../../api/trainees";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PaginatedPicker from "../../components/PaginatedPicker";
import Spinner from "../../components/Spinner";
import Table, { Row } from "../../components/Table";
import { useToast } from "../../components/Toast";

export default function CohortDetail() {
  const { cohortId } = useParams();
  const toast = useToast();
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
      toast.show("Trainee added to cohort");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <div className="space-y-2 border-b border-rule pb-5">
        <Link to="/cohorts" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
          <ArrowLeft className="h-3.5 w-3.5" /> Back to cohorts
        </Link>
        <div className="kicker">Cohort</div>
        <h1 className="font-display text-3xl font-semibold text-ink">Members</h1>
      </div>

      <section>
        <h2 className="mb-3 font-display text-xl font-semibold text-ink">Add a trainee</h2>
        <Card>
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
            <Button type="submit" loading={submitting}>
              {submitting ? "Adding..." : "Add to cohort"}
            </Button>
          </form>
        </Card>
      </section>

      <section className="space-y-3">
        <h2 className="font-display text-xl font-semibold text-ink">Current members</h2>
        {members.loading && <Spinner />}
        <ErrorMessage error={members.error} />
        {members.data && members.data.items.length === 0 && (
          <EmptyState>This cohort has no members yet.</EmptyState>
        )}
        {members.data && members.data.items.length > 0 && (
          <Table head={["Name", "Email", "Status", "Added"]}>
            {members.data.items.map((m) => (
              <Row key={m.id}>
                <td className="px-4 py-3 font-medium text-ink">{m.name}</td>
                <td className="px-4 py-3 text-muted">{m.email}</td>
                <td className="px-4 py-3">
                  {m.active ? (
                    <span style={{ color: "var(--done-fg)" }}>Active</span>
                  ) : (
                    <span className="text-muted">Deactivated</span>
                  )}
                </td>
                <td className="px-4 py-3 tnum text-muted">{formatDate(m.added_at)}</td>
              </Row>
            ))}
          </Table>
        )}
      </section>
    </div>
  );
}
