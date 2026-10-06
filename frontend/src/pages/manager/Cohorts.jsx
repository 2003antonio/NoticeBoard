import { useState } from "react";
import { Link } from "react-router-dom";

import { createCohort, listCohorts } from "../../api/cohorts";
import { useLoader } from "../../hooks/useLoader";
import Button from "../../components/Button";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import FormField, { inputClass } from "../../components/FormField";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import Table from "../../components/Table";

const PAGE = 20;

export default function Cohorts() {
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
    } catch (err) {
      setError(err);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-semibold text-slate-800">Cohorts</h1>

      <section className="rounded-lg border border-slate-200 bg-white p-5">
        <h2 className="mb-3 font-semibold text-slate-800">Create a cohort</h2>
        <form onSubmit={handleCreate} className="flex flex-wrap items-end gap-3" noValidate>
          <div className="flex-1">
            <FormField label="Name" id="cohort-name" error={error?.fieldError?.("name")}>
              <input
                id="cohort-name"
                required
                maxLength={100}
                className={inputClass}
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </FormField>
          </div>
          <Button type="submit" disabled={submitting}>
            {submitting ? "Creating..." : "Create"}
          </Button>
        </form>
        <div className="mt-2">
          <ErrorMessage error={error && !error.details?.length ? error : null} />
        </div>
      </section>

      <section className="space-y-3">
        {list.loading && <Spinner />}
        <ErrorMessage error={list.error} />
        {list.data && list.data.items.length === 0 && <EmptyState>No cohorts yet.</EmptyState>}
        {list.data && list.data.items.length > 0 && (
          <>
            <Table head={["Name", "Members", ""]}>
              {list.data.items.map((c) => (
                <tr key={c.id}>
                  <td className="px-4 py-2 font-medium text-slate-800">{c.name}</td>
                  <td className="px-4 py-2 text-slate-600">{c.member_count}</td>
                  <td className="px-4 py-2 text-right">
                    <Link to={`/cohorts/${c.id}`} className="text-blue-600 hover:underline">
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
