import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";

import { listNotifications } from "../api/notifications";
import { onNotificationsChanged } from "../lib/notificationsBus";

// Shows the unread count. It refetches on navigation and whenever the
// Notifications page reports a change -- there is no background polling loop.
export default function NotificationBell() {
  const [count, setCount] = useState(0);
  const location = useLocation();

  useEffect(() => {
    let active = true;
    // limit=1: we only need the unread_count field, not the rows themselves.
    listNotifications(true, 1, 0)
      .then((data) => active && setCount(data.unread_count))
      .catch(() => {}); // the bell is non-critical; never break the shell over it
    return () => {
      active = false;
    };
  }, [location.pathname]);

  // Also refresh immediately after a mark-as-read happens elsewhere.
  useEffect(() => {
    return onNotificationsChanged(() => {
      listNotifications(true, 1, 0)
        .then((data) => setCount(data.unread_count))
        .catch(() => {});
    });
  }, []);

  return (
    <Link
      to="/notifications"
      className="relative rounded-md px-2 py-1 text-slate-600 hover:bg-slate-100"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
    >
      <span aria-hidden="true" className="text-lg">🔔</span>
      {count > 0 && (
        <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-blue-600 px-1.5 text-center text-xs font-semibold text-white">
          {count}
        </span>
      )}
    </Link>
  );
}
