import { Link } from "react-router-dom";

import { myPlans } from "../../api/myplans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import Spinner from "../../components/Spinner";
import StatusBadge from "../../components/StatusBadge";
import Table from "../../components/Table";

export default function MyPlans() {
  const { data, loading, error } = useLoader(() => myPlans(), []);

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-semibold text-slate-800">My plans</h1>

      {loading && <Spinner />}
      <ErrorMessage error={error} />

      {data && data.items.length === 0 && (
        <EmptyState>You have no plans assigned yet.</EmptyState>
      )}

      {data && data.items.length > 0 && (
        <Table head={["Plan", "Due date", "Source", "Latest status", ""]}>
          {data.items.map((p) => (
            <tr key={p.id}>
              <td className="px-4 py-2 font-medium text-slate-800">{p.title}</td>
              <td className="px-4 py-2">{formatDate(p.due_date)}</td>
              <td className="px-4 py-2 text-slate-600">{p.source}</td>
              <td className="px-4 py-2">
                <StatusBadge status={p.latest_status || "no_report"} />
              </td>
              <td className="px-4 py-2 text-right">
                {/* Pass the plan along so the detail page can reuse it without a
                    dedicated per-plan endpoint (there isn't one). */}
                <Link to={`/my/plans/${p.id}`} state={{ plan: p }} className="text-blue-600 hover:underline">
                  Open
                </Link>
              </td>
            </tr>
          ))}
        </Table>
      )}
    </div>
  );
}
