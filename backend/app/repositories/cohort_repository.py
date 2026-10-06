"""The ONLY place that writes SQL about cohorts and their members."""

from app.repositories.notification_repository import NEW_PLAN_MESSAGE_SQL


def create(conn, name: str, created_by):
    return conn.execute(
        "INSERT INTO cohorts (name, created_by) VALUES (%s, %s) RETURNING id, name, created_at, 0 AS member_count",
        (name, created_by),
    ).fetchone()


def get(conn, cohort_id):
    return conn.execute("SELECT id, name, created_at FROM cohorts WHERE id = %s", (cohort_id,)).fetchone()


def list_with_counts(conn, limit: int, offset: int):
    items = conn.execute(
        """SELECT c.id, c.name, c.created_at, count(m.trainee_id)::int AS member_count
           FROM cohorts c LEFT JOIN cohort_members m ON m.cohort_id = c.id
           GROUP BY c.id ORDER BY lower(c.name), c.id LIMIT %s OFFSET %s""",
        (limit, offset),
    ).fetchall()
    total = conn.execute("SELECT count(*) AS n FROM cohorts").fetchone()["n"]
    return items, total


def lock(conn, cohort_id) -> None:
    """Take a row lock on the cohort for the rest of this transaction.

    Adding a member and assigning a plan to the same cohort both grab this lock,
    so they take turns. Without it, a member added at the very moment a plan is
    being assigned could be missed by the assignment's fan-out AND find no plan
    yet when their own late-joiner catch-up runs -- and never get notified.
    """
    conn.execute("SELECT id FROM cohorts WHERE id = %s FOR UPDATE", (cohort_id,))


def add_member(conn, cohort_id, trainee_id) -> None:
    conn.execute(
        "INSERT INTO cohort_members (cohort_id, trainee_id) VALUES (%s, %s)", (cohort_id, trainee_id)
    )


def notify_existing_plans(conn, cohort_id, trainee_id) -> int:
    """Late joiner: one notification for each plan ALREADY assigned to this
    cohort, in one set-based insert. Returns how many were created."""
    cur = conn.execute(
        f"""INSERT INTO notifications (user_id, message, plan_id)
            SELECT %s, {NEW_PLAN_MESSAGE_SQL}, p.id
            FROM plan_assignments a JOIN plans p ON p.id = a.plan_id
            WHERE a.cohort_id = %s""",
        (trainee_id, cohort_id),
    )
    return cur.rowcount


def list_members(conn, cohort_id):
    return conn.execute(
        """SELECT u.id, u.name, u.email, u.active, m.added_at
           FROM cohort_members m JOIN users u ON u.id = m.trainee_id
           WHERE m.cohort_id = %s ORDER BY lower(u.name), u.id""",
        (cohort_id,),
    ).fetchall()
