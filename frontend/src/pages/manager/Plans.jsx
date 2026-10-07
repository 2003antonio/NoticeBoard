import { useState } from "react";

import { createPlan, listPlans } from "../../api/plans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import Button from "../../components/Button";
import Card from "../../components/Card";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import PageHeader from "../../components/PageHeader";
import Pagination from "../../components/Pagination";
import { SkeletonTable } from "../../components/Skeleton";
import Table, { OpenHint, RowLink, StretchedLink } from "../../components/Table";
import { useToast } from "../../components/Toast";

const PAGE = 20;
const TODAY = new Date().toISOString().slice(0, 10);

export default function Plans() {
  const toast = useToast();
  const [offset, setOffset] = useState(0);
  const list = useLoader(() => listPlans(PAGE, offset), [offset]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleCreate(e) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const body = { title: title.trim() };
      if (description.trim()) body.description = description.trim();
      if (dueDate) body.due_date = dueDate;
      await createPlan(body);
      setTitle("");
      setDescription("");
      setDueDate("");
      setOffset(0);
      list.reload();
      toast.show("Plan created");
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader kicker="Manager" title="Plans" lead="Create training plans and assign them to cohorts or trainees." />

      <section className="grid gap-8 lg:grid-cols-[1fr_1.4fr]">
        <Card>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Create a plan</h2>
          <form onSubmit={handleCreate} className="space-y-4" noValidate>
            <FormField label="Title" id="title" error={error?.fieldError?.("title")}>
              <input id="title" required maxLength={200} className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} />
            </FormField>
            <FormField label="Description (optional)" id="description" error={error?.fieldError?.("description")}>
              <textarea id="description" rows={2} maxLength={2000} className={inputClass} value={description} onChange={(e) => setDescription(e.target.value)} />
            </FormField>
            <FormField label="Due date (optional)" id="due_date" error={error?.fieldError?.("due_date")} hint="Cannot be in the past.">
              <input id="due_date" type="date" min={TODAY} className={inputClass} value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
            </FormField>
            <ErrorMessage error={error && !error.details?.length ? error : null} />
            <Button type="submit" loading={submitting}>
              {submitting ? "Creating..." : "Create plan"}
            </Button>
          </form>
        </Card>

        <div className="space-y-3">
          <h2 className="font-display text-lg font-semibold text-ink">All plans</h2>
          {list.loading && <SkeletonTable rows={4} cols={3} />}
          <ErrorMessage error={list.error} />
          {list.data && list.data.items.length === 0 && <EmptyState>No plans yet. Create your first one.</EmptyState>}
          {list.data && list.data.items.length > 0 && (
            <>
              <Table head={["Title", "Due date", "Created", ""]}>
                {list.data.items.map((p) => (
                  <RowLink key={p.id} to={`/plans/${p.id}`}>
                    <td className="px-4 py-3">
                      <StretchedLink to={`/plans/${p.id}`}>{p.title}</StretchedLink>
                    </td>
                    <td className="px-4 py-3 tnum text-muted">{formatDate(p.due_date)}</td>
                    <td className="px-4 py-3 tnum text-muted">{formatDate(p.created_at)}</td>
                    <td className="px-4 py-3 text-right"><OpenHint /></td>
                  </RowLink>
                ))}
              </Table>
              <Pagination total={list.data.total} limit={PAGE} offset={offset} onChange={setOffset} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
