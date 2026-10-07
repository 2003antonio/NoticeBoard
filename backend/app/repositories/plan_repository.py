"""The ONLY place that writes SQL about plans and their assignments."""

from app.repositories._search import like_contains
from app.repositories.notification_repository import NEW_PLAN_MESSAGE_SQL

PLAN_COLUMNS = "id, title, description, due_date, created_at"
ASSIGNMENT_COLUMNS = "id, plan_id, cohort_id, trainee_id, assigned_at"


def create(conn, title: str, description, due_date, created_by):
    return conn.execute(
        f"""INSERT INTO plans (title, description, due_date, created_by)
            VALUES (%s, %s, %s, %s) RETURNING {PLAN_COLUMNS}""",
        (title, description, due_date, created_by),
    ).fetchone()


def get(conn, plan_id):
    return conn.execute(f"SELECT {PLAN_COLUMNS} FROM plans WHERE id = %s", (plan_id,)).fetchone()


def list_plans(conn, limit: int, offset: int, not_assigned_cohort=None, q=None):
    """List plans, newest first. Optional filters for the "add plan to cohort"
    picker: not_assigned_cohort hides plans that cohort already has; q is a
    title contains-search. No filter = behaviour unchanged."""
    where = ["TRUE"]
    params = []
    if not_assigned_cohort is not None:
        # Anti-join: plan not yet assigned to this cohort (uses the partial
        # unique index on (plan_id, cohort_id)).
        where.append("NOT EXISTS (SELECT 1 FROM plan_assignments a WHERE a.cohort_id = %s AND a.plan_id = plans.id)")
        params.append(not_assigned_cohort)
    if q:
        where.append("title ILIKE %s")
        params.append(like_contains(q))

    clause = " AND ".join(where)
    items = conn.execute(
        f"SELECT {PLAN_COLUMNS} FROM plans WHERE {clause} ORDER BY created_at DESC, id LIMIT %s OFFSET %s",
        (*params, limit, offset),
    ).fetchall()
    total = conn.execute(f"SELECT count(*) AS n FROM plans WHERE {clause}", tuple(params)).fetchone()["n"]
    return items, total


def assignments(conn, plan_id, limit: int, offset: int):
    """Who a plan is assigned to: its cohorts and its directly-assigned trainees.
    Both lists are bounded by limit/offset (the trainee list can grow), and each
    reports its own total. Uses the partial unique indexes on plan_assignments."""
    cohorts = conn.execute(
        """SELECT c.id, c.name, a.assigned_at
           FROM plan_assignments a JOIN cohorts c ON c.id = a.cohort_id
           WHERE a.plan_id = %s AND a.cohort_id IS NOT NULL
           ORDER BY lower(c.name), c.id LIMIT %s OFFSET %s""",
        (plan_id, limit, offset),
    ).fetchall()
    cohorts_total = conn.execute(
        "SELECT count(*) AS n FROM plan_assignments WHERE plan_id = %s AND cohort_id IS NOT NULL",
        (plan_id,),
    ).fetchone()["n"]

    trainees = conn.execute(
        """SELECT u.id, u.name, u.email, a.assigned_at
           FROM plan_assignments a JOIN users u ON u.id = a.trainee_id
           WHERE a.plan_id = %s AND a.trainee_id IS NOT NULL
           ORDER BY lower(u.name), u.id LIMIT %s OFFSET %s""",
        (plan_id, limit, offset),
    ).fetchall()
    trainees_total = conn.execute(
        "SELECT count(*) AS n FROM plan_assignments WHERE plan_id = %s AND trainee_id IS NOT NULL",
        (plan_id,),
    ).fetchone()["n"]

    return cohorts, cohorts_total, trainees, trainees_total


def assign_cohort(conn, plan_id, cohort_id):
    return conn.execute(
        f"""INSERT INTO plan_assignments (plan_id, cohort_id) VALUES (%s, %s)
            RETURNING {ASSIGNMENT_COLUMNS}""",
        (plan_id, cohort_id),
    ).fetchone()


def assign_trainee(conn, plan_id, trainee_id):
    return conn.execute(
        f"""INSERT INTO plan_assignments (plan_id, trainee_id) VALUES (%s, %s)
            RETURNING {ASSIGNMENT_COLUMNS}""",
        (plan_id, trainee_id),
    ).fetchone()


def notify_cohort(conn, plan_id, cohort_id) -> int:
    """One set-based insert: every ACTIVE member of the cohort gets one
    notification. No Python loop, so a cohort of thousands is still one query.
    Returns how many notifications were created."""
    cur = conn.execute(
        f"""INSERT INTO notifications (user_id, message, plan_id)
            SELECT m.trainee_id, {NEW_PLAN_MESSAGE_SQL}, p.id
            FROM cohort_members m
            JOIN users u ON u.id = m.trainee_id
            JOIN plans p ON p.id = %s
            WHERE m.cohort_id = %s AND u.active = true""",
        (plan_id, cohort_id),
    )
    return cur.rowcount


def notify_trainee(conn, plan_id, trainee_id) -> int:
    cur = conn.execute(
        f"""INSERT INTO notifications (user_id, message, plan_id)
            SELECT %s, {NEW_PLAN_MESSAGE_SQL}, p.id FROM plans p WHERE p.id = %s""",
        (trainee_id, plan_id),
    )
    return cur.rowcount


def my_plans(conn, trainee_id):
    """Every plan assigned to this trainee, directly or through any cohort they
    belong to, each plan exactly once, with their latest progress report.

    A plan can reach a trainee several ways. We pick a single source with a fixed
    rule so the answer is stable: a direct assignment wins; otherwise the
    alphabetically-first cohort name wins. prio 0 (direct) sorts before prio 1
    (cohort), and within cohorts we sort by the lower-cased name.
    """
    return conn.execute(
        """
        SELECT chosen.id, chosen.title, chosen.description, chosen.due_date, chosen.source,
               r.status AS latest_status, r.submitted_at AS last_report_at
        FROM (
          SELECT DISTINCT ON (plan_id)
                 plan_id AS id, title, description, due_date, source
          FROM (
            SELECT p.id AS plan_id, p.title, p.description, p.due_date,
                   'direct' AS source, 0 AS prio, '' AS sort_name
            FROM plan_assignments a JOIN plans p ON p.id = a.plan_id
            WHERE a.trainee_id = %s
            UNION ALL
            SELECT p.id, p.title, p.description, p.due_date,
                   c.name AS source, 1 AS prio, lower(c.name) AS sort_name
            FROM plan_assignments a
            JOIN plans p ON p.id = a.plan_id
            JOIN cohorts c ON c.id = a.cohort_id
            JOIN cohort_members m ON m.cohort_id = c.id
            WHERE m.trainee_id = %s
          ) reached
          ORDER BY plan_id, prio, sort_name
        ) chosen
        -- Latest report per plan: one indexed lookup each (reports_trainee_plan_idx).
        LEFT JOIN LATERAL (
          SELECT status, submitted_at FROM progress_reports pr
          WHERE pr.trainee_id = %s AND pr.plan_id = chosen.id
          ORDER BY pr.submitted_at DESC, pr.id DESC LIMIT 1
        ) r ON true
        ORDER BY chosen.due_date NULLS LAST, lower(chosen.title), chosen.id
        """,
        (trainee_id, trainee_id, trainee_id),
    ).fetchall()
