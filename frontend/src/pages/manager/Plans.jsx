import { useState } from "react";
import { Link } from "react-router-dom";

import { createPlan, listPlans } from "../../api/plans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import Table from "../../components/Table";

const PAGE = 20;
const TODAY = new Date().toISOString().slice(0, 10); // for the date input's min

export default function Plans() {
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
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Plans</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-800">Create a plan</h2>
        <form onSubmit={handleCreate} className="space-y-4" noValidate>
          <FormField label="Title" id="title" error={error?.fieldError?.("title")}>
            <input
              id="title"
              required
              maxLength={200}
              className={inputClass}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </FormField>

          <FormField label="Description (optional)" id="description" error={error?.fieldError?.("description")}>
            <textarea
              id="description"
              rows={2}
              maxLength={2000}
              className={inputClass}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </FormField>

          <FormField
            label="Due date (optional)"
            id="due_date"
            error={error?.fieldError?.("due_date")}
            hint="Cannot be in the past."
          >
            <input
              id="due_date"
              type="date"
              min={TODAY}
              className={inputClass}
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
            />
          </FormField>

          <ErrorMessage error={error && !error.details?.length ? error : null} />

          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create plan"}
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        {list.loading && <Spinner />}
        <ErrorMessage error={list.error} />
        {list.data && list.data.items.length === 0 && <EmptyState>No plans yet.</EmptyState>}
        {list.data && list.data.items.length > 0 && (
          <>
            <Table head={["Title", "Due date", "Created", ""]}>
              {list.data.items.map((p) => (
                <tr key={p.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{p.title}</td>
                  <td className="px-4 py-2">{formatDate(p.due_date)}</td>
                  <td className="px-4 py-2 text-slate-600">{formatDate(p.created_at)}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/plans/${p.id}`} className="text-blue-600 hover:underline">
                      Open
                    </Link>
                  </td>
                </tr>
              ))}
            </Table>
            <Pagination total={list.data.total} limit={PAGE} offset={offset} onChange={setOffset} />
          </>
        )}
      </section>
    </div>
  );
}
