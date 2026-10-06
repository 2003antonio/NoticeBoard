// A tiny pub/sub so the notification bell can refresh its unread count right
// after the Notifications page marks something read, without those two
// components having to know about each other.
const listeners = new Set();

export function onNotificationsChanged(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function emitNotificationsChanged() {
  for (const fn of listeners) fn();
}
