import { useState } from "react";
import { BellOff } from "lucide-react";

import { listNotifications, markRead } from "../api/notifications";
import { useLoader } from "../hooks/useLoader";
import { emitNotificationsChanged } from "../lib/notificationsBus";
import { relativeTime } from "../lib/format";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
import PageHeader from "../components/PageHeader";
import Pagination from "../components/Pagination";
import Spinner from "../components/Spinner";

const PAGE = 20;

export default function Notifications() {
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [offset, setOffset] = useState(0);
  const [markingId, setMarkingId] = useState(null);

  const { data, loading, error, reload } = useLoader(
    () => listNotifications(unreadOnly, PAGE, offset),
    [unreadOnly, offset]
  );

  async function handleMarkRead(id) {
    setMarkingId(id);
    try {
      await markRead(id);
      emitNotificationsChanged();
      reload();
    } finally {
      setMarkingId(null);
    }
  }

  // Unread first within the page, then as the server sorted (newest first).
  const items = data ? [...data.items].sort((a, b) => Number(a.is_read) - Number(b.is_read)) : [];

  return (
    <div className="space-y-6">
      <PageHeader
        kicker="Inbox"
        title="Notifications"
        actions={
          data && (
            <span className="kicker">
              <span className="numeral text-accent">{data.unread_count}</span> unread
            </span>
          )
        }
      />

      <label className="flex items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          className="accent-[var(--accent)]"
          checked={unreadOnly}
          onChange={(e) => {
            setOffset(0);
            setUnreadOnly(e.target.checked);
          }}
        />
        Show unread only
      </label>

      {loading && <Spinner />}
      <ErrorMessage error={error} />

      {data && items.length === 0 && (
        <EmptyState icon={BellOff}>
          {unreadOnly ? "No unread notifications." : "No notifications yet."}
        </EmptyState>
      )}

      {items.length > 0 && (
        <>
          <ul className="divide-y divide-rule rounded-lg border border-rule bg-surface">
            {items.map((n) => (
              <li key={n.id} className="flex items-start justify-between gap-4 px-4 py-3">
                <div className="flex items-start gap-3">
                  {/* Unread marker: a filled accent dot; read rows get a hollow slot. */}
                  <span
                    aria-hidden="true"
                    className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.is_read ? "bg-rule" : "bg-accent"}`}
                  />
                  <div>
                    <p className={`text-sm ${n.is_read ? "text-muted" : "font-medium text-ink"}`}>{n.message}</p>
                    <p className="kicker mt-0.5">{relativeTime(n.created_at)}</p>
                  </div>
                </div>
                {!n.is_read && (
                  <Button variant="secondary" loading={markingId === n.id} onClick={() => handleMarkRead(n.id)}>
                    Mark read
                  </Button>
                )}
              </li>
            ))}
          </ul>
          <Pagination total={data.total} limit={PAGE} offset={offset} onChange={setOffset} />
        </>
      )}
    </div>
  );
}
