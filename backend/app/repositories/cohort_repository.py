"""The ONLY place that writes SQL about cohorts and their members."""

from app.repositories._search import like_contains
from app.repositories.notification_repository import NEW_PLAN_MESSAGE_SQL


def create(conn, name: str, created_by):
    return conn.execute(
        "INSERT INTO cohorts (name, created_by) VALUES (%s, %s) RETURNING id, name, created_at, 0 AS member_count",
        (name, created_by),
    ).fetchone()


def get(conn, cohort_id):
    return conn.execute("SELECT id, name, created_at FROM cohorts WHERE id = %s", (cohort_id,)).fetchone()


def list_with_counts(conn, limit: int, offset: int, not_assigned_plan=None, q=None):
    """List cohorts with member counts. Optional filters for the plan page's
    "assign to a cohort" picker: not_assigned_plan hides cohorts that already
    have the plan; q is a name contains-search. No filter = behaviour unchanged."""
    where = ["TRUE"]
    params = []
    if not_assigned_plan is not None:
        # Anti-join: cohort not yet assigned this plan (uses the partial unique
        # index on (plan_id, cohort_id)).
        where.append("NOT EXISTS (SELECT 1 FROM plan_assignments a WHERE a.plan_id = %s AND a.cohort_id = c.id)")
        params.append(not_assigned_plan)
    if q:
        where.append("c.name ILIKE %s")
        params.append(like_contains(q))

    clause = " AND ".join(where)
    items = conn.execute(
        f"""SELECT c.id, c.name, c.created_at, count(m.trainee_id)::int AS member_count
            FROM cohorts c LEFT JOIN cohort_members m ON m.cohort_id = c.id
            WHERE {clause}
            GROUP BY c.id ORDER BY lower(c.name), c.id LIMIT %s OFFSET %s""",
        (*params, limit, offset),
    ).fetchall()
    total = conn.execute(f"SELECT count(*) AS n FROM cohorts c WHERE {clause}", tuple(params)).fetchone()["n"]
    return items, total


def active_member_count(conn, cohort_id) -> int:
    """How many ACTIVE members a cohort has -- i.e. how many people get a plan
    assigned to it. Shown against each plan in the cohort's plans table."""
    return conn.execute(
        """SELECT count(*) AS n FROM cohort_members m JOIN users u ON u.id = m.trainee_id
           WHERE m.cohort_id = %s AND u.active""",
        (cohort_id,),
    ).fetchone()["n"]


def list_cohort_plans(conn, cohort_id, limit: int, offset: int):
    """Plans assigned to this cohort, newest assignment first."""
    items = conn.execute(
        """SELECT p.id, p.title, p.due_date, a.assigned_at
           FROM plan_assignments a JOIN plans p ON p.id = a.plan_id
           WHERE a.cohort_id = %s
           ORDER BY a.assigned_at DESC, p.id LIMIT %s OFFSET %s""",
        (cohort_id, limit, offset),
    ).fetchall()
    total = conn.execute(
        "SELECT count(*) AS n FROM plan_assignments WHERE cohort_id = %s", (cohort_id,)
    ).fetchone()["n"]
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
