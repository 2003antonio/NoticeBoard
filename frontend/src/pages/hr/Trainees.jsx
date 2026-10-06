import { useState } from "react";

import { listTrainees } from "../../api/trainees";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import Pagination from "../../components/Pagination";
import Spinner from "../../components/Spinner";
import Table from "../../components/Table";

const PAGE = 20;

export default function Trainees() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useLoader(() => listTrainees(PAGE, offset), [offset]);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">Trainees</h1>

      {loading && <Spinner />}
      <ErrorMessage error={error} />

      {data && data.items.length === 0 && <EmptyState>No trainees yet.</EmptyState>}

      {data && data.items.length > 0 && (
        <>
          <Table head={["Name", "Email", "Status", "Joined"]}>
            {data.items.map((t) => (
              <tr key={t.id}>
                <td className="px-4 py-2 font-medium text-slate-800">{t.name}</td>
                <td className="px-4 py-2 text-slate-600">{t.email}</td>
                <td className="px-4 py-2">
                  {t.active ? (
                    <span className="text-green-700">Active</span>
                  ) : (
                    <span className="text-slate-500">Deactivated</span>
                  )}
                </td>
                <td className="px-4 py-2 text-slate-600">{formatDate(t.created_at)}</td>
              </tr>
            ))}
          </Table>
          <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
