import { ArrowRight, BookOpen } from "lucide-react";
import { Link } from "react-router-dom";

import { myPlans } from "../../api/myplans";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import { SkeletonTable } from "../../components/Skeleton";
import StatusBadge from "../../components/StatusBadge";
import Table, { Row } from "../../components/Table";

export default function MyPlans() {
  const { data, loading, error } = useLoader(() => myPlans(), []);

  return (
    <div className="space-y-6">
      <PageHeader kicker="Trainee" title="My plans" lead="Training plans assigned to you, and where each one stands." />

      {loading && <SkeletonTable rows={4} cols={4} />}
      <ErrorMessage error={error} />

      {data && data.items.length === 0 && (
        <EmptyState icon={BookOpen}>No plans assigned yet. They'll appear here once a manager assigns one.</EmptyState>
      )}

      {data && data.items.length > 0 && (
        <Table head={["Plan", "Due date", "Source", "Latest status", ""]}>
          {data.items.map((p) => (
            <Row key={p.id}>
              <td className="px-4 py-3 font-medium text-ink">{p.title}</td>
              <td className="px-4 py-3 tnum text-muted">{formatDate(p.due_date)}</td>
              <td className="px-4 py-3 text-muted">{p.source}</td>
              <td className="px-4 py-3">
                <StatusBadge status={p.latest_status || "no_report"} />
              </td>
              <td className="px-4 py-3 text-right">
                {/* Pass the plan along so the detail page can reuse it without a
                    dedicated per-plan endpoint (there isn't one). */}
                <Link
                  to={`/my/plans/${p.id}`}
                  state={{ plan: p }}
                  className="inline-flex items-center gap-1 font-medium text-accent hover:underline"
                >
                  Open <ArrowRight className="h-3.5 w-3.5" />
                </Link>
              </td>
            </Row>
          ))}
        </Table>
      )}
    </div>
  );
}
