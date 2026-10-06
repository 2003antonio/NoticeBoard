from app.core.errors import AppError
from app.repositories import notification_repository


def list_mine(conn, user_id, unread_only: bool, limit: int, offset: int):
    items, total = notification_repository.list_for_user(conn, user_id, unread_only, limit, offset)
    # unread_count is always the full unread total, not just this page.
    unread = notification_repository.unread_count(conn, user_id)
    return {"items": items, "total": total, "limit": limit, "offset": offset, "unread_count": unread}


def mark_read(conn, user_id, notification_id):
    row = notification_repository.mark_read(conn, user_id, notification_id)
    if not row:
        # Either it doesn't exist or it isn't this user's. Same answer either way,
        # so we never reveal that another user's notification exists. Marking an
        # already-read notification simply returns the row again (idempotent).
        raise AppError(404, "Notification not found")
    return row
