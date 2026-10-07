import { useState } from "react";

import { listTrainees } from "../../api/trainees";
import { useLoader } from "../../hooks/useLoader";
import { formatDate } from "../../lib/format";
import EmptyState from "../../components/EmptyState";
import ErrorMessage from "../../components/ErrorMessage";
import PageHeader from "../../components/PageHeader";
import Pagination from "../../components/Pagination";
import { SkeletonTable } from "../../components/Skeleton";
import Table, { Row } from "../../components/Table";

const PAGE = 20;

export default function Trainees() {
  const [offset, setOffset] = useState(0);
  const { data, loading, error } = useLoader(() => listTrainees(PAGE, offset), [offset]);

  return (
    <div className="space-y-6">
      <PageHeader kicker="People" title="Trainees" lead="Everyone onboarded into the programme." />

      {loading && <SkeletonTable rows={5} cols={4} />}
      <ErrorMessage error={error} />

      {data && data.items.length === 0 && <EmptyState>No trainees yet.</EmptyState>}

      {data && data.items.length > 0 && (
        <>
          <Table head={["Name", "Email", "Status", "Joined"]}>
            {data.items.map((t) => (
              <Row key={t.id}>
                <td className="px-4 py-3 font-medium text-ink">{t.name}</td>
                <td className="px-4 py-3 text-muted">{t.email}</td>
                <td className="px-4 py-3">
                  {t.active ? (
                    <span style={{ color: "var(--done-fg)" }}>Active</span>
                  ) : (
                    <span className="text-muted">Deactivated</span>
                  )}
                </td>
                <td className="px-4 py-3 tnum text-muted">{formatDate(t.created_at)}</td>
              </Row>
            ))}
          </Table>
          <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
