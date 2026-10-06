import { useState } from "react";

import { listNotifications, markRead } from "../api/notifications";
import { useLoader } from "../hooks/useLoader";
import { emitNotificationsChanged } from "../lib/notificationsBus";
import { formatDateTime } from "../lib/format";
import Button from "../components/Button";
import EmptyState from "../components/EmptyState";
import ErrorMessage from "../components/ErrorMessage";
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
      emitNotificationsChanged(); // let the bell refresh its count
      reload();
    } finally {
      setMarkingId(null);
    }
  }

  // Unread first within the page, then newest first (the backend already sorts
  // by time; this just floats the unread ones to the top for the reader).
  const items = data
    ? [...data.items].sort((a, b) => Number(a.is_read) - Number(b.is_read))
    : [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold text-slate-800">Notifications</h1>
        {data && (
          <span className="text-sm text-slate-500">{data.unread_count} unread</span>
        )}
      </div>

      <label className="flex items-center gap-2 text-sm text-slate-600">
        <input
          type="checkbox"
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
        <EmptyState>{unreadOnly ? "No unread notifications." : "No notifications yet."}</EmptyState>
      )}

      {items.length > 0 && (
        <>
          <ul className="space-y-2">
            {items.map((n) => (
              <li
                key={n.id}
                className={
                  "flex items-start justify-between gap-4 rounded-md border px-4 py-3 " +
                  (n.is_read ? "border-slate-200 bg-white" : "border-blue-200 bg-blue-50")
                }
              >
                <div>
                  <p className="text-sm text-slate-800">{n.message}</p>
                  <p className="text-xs text-slate-500">{formatDateTime(n.created_at)}</p>
                </div>
                {!n.is_read && (
                  <Button
                    variant="secondary"
                    disabled={markingId === n.id}
                    onClick={() => handleMarkRead(n.id)}
                  >
                    {markingId === n.id ? "..." : "Mark read"}
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
