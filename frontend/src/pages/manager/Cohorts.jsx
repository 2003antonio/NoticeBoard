import { useState } from "react";
import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { createCohort, listCohorts } from "../../api/cohorts";
import { useLoader } from "../../hooks/useLoader";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import PageHeader from "../../components/PageHeader";
import Pagination from "../../components/Pagination";
import { SkeletonTable } from "../../components/Skeleton";
import Table, { Row } from "../../components/Table";
import { useToast } from "../../components/Toast";

const PAGE = 20;

export default function Cohorts() {
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const list = useLoader(() => listCohorts(PAGE, offset), [offset]);

  const [name, setName] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await createCohort(name.trim());
      setName("");
      setOffset(0);
      list.reload();
      toast.show("Cohort created");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader kicker="Manager" title="Cohorts" lead="Groups of trainees you can assign plans to all at once." />

      <Card>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="min-w-56 flex-1">
            <FormField label="New cohort name" id="cohort-name" error={error?.fieldError?.("name")}>
              <input id="cohort-name" required maxLength={100} className={inputClass} value={name} onChange={(e) => setName(e.target.value)} />
            </FormField>
          </div>
          <Button type="submit" loading={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </form>
        <div className="mt-2">
          <ErrorMessage error={error && !error.details?.length ? error : null} />
        </div>
      </Card>

      <section className="space-y-3">
        {list.loading && <SkeletonTable rows={4} cols={2} />}
        <ErrorMessage error={list.error} />
        {list.data && list.data.items.length === 0 && <EmptyState>No cohorts yet.</EmptyState>}
        {list.data && list.data.items.length > 0 && (
          <>
            <Table head={["Name", "Members", ""]}>
              {list.data.items.map((c) => (
                <Row key={c.id}>
                  <td className="px-4 py-3 font-medium text-ink">{c.name}</td>
                  <td className="px-4 py-3 tnum text-muted">{c.member_count}</td>
                  <td className="px-4 py-3 text-right">
                    <Link to={`/cohorts/${c.id}`} className="inline-flex items-center gap-1 font-medium text-accent hover:underline">
                      Open <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </td>
                </Row>
              ))}
            </Table>
            <Pagination total={list.data.total} limit={PAGE} offset={offset} onChange={setOffset} />
          </>
        )}
      </section>
    </div>
  );
}
