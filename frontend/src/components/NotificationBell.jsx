import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
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
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [location.pathname]);

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
      className="relative rounded-md border border-rule bg-surface p-2 text-ink transition-colors hover:bg-paper focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      aria-label={`Notifications${count ? `, ${count} unread` : ""}`}
    >
      <Bell className="h-4 w-4" />
      {count > 0 && (
        <span className="numeral absolute -right-1.5 -top-1.5 min-w-[18px] rounded-full bg-accent px-1 text-center text-[11px] font-semibold leading-4 text-accent-contrast">
          {count}
        </span>
      )}
    </Link>
  );
}
