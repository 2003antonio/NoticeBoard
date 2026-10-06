"""The ONLY place that writes SQL about notifications."""

NOTIF_COLUMNS = "id, message, is_read, plan_id, created_at"

# The text of a "new plan assigned" notification, built in SQL so that every
# fan-out path (cohort assignment, solo assignment, late joiner) produces the
# exact same string and they can never drift apart. Any query that uses this
# MUST expose the plan row under the alias `p`.
NEW_PLAN_MESSAGE_SQL = (
    "'New plan assigned: ' || p.title || "
    "CASE WHEN p.due_date IS NOT NULL "
    "THEN ' (due ' || to_char(p.due_date, 'YYYY-MM-DD') || ')' "
    "ELSE '' END"
)


def list_for_user(conn, user_id, unread_only: bool, limit: int, offset: int):
    # The only varying part of the WHERE clause is a fixed boolean flag, never a
    # user value, so building it as text here is safe; all values stay parameters.
    where = "user_id = %s" + (" AND is_read = false" if unread_only else "")
    items = conn.execute(
        f"""SELECT {NOTIF_COLUMNS} FROM notifications WHERE {where}
            ORDER BY created_at DESC, id DESC LIMIT %s OFFSET %s""",
        (user_id, limit, offset),
    ).fetchall()
    total = conn.execute(
        f"SELECT count(*) AS n FROM notifications WHERE {where}", (user_id,)
    ).fetchone()["n"]
    return items, total


def unread_count(conn, user_id) -> int:
    # Counts ALL of the user's unread notifications, independent of paging.
    return conn.execute(
        "SELECT count(*) AS n FROM notifications WHERE user_id = %s AND is_read = false",
        (user_id,),
    ).fetchone()["n"]


def mark_read(conn, user_id, notification_id):
    # Matching on user_id as well as id means someone else's notification (or a
    # missing one) simply updates no row and returns None -- the caller turns
    # that into a 404, so we never reveal that another user's notification exists.
    return conn.execute(
        f"""UPDATE notifications SET is_read = true
            WHERE id = %s AND user_id = %s RETURNING {NOTIF_COLUMNS}""",
        (notification_id, user_id),
    ).fetchone()
