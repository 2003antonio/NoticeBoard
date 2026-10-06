"""The ONLY place that writes SQL about progress reports."""

REPORT_COLUMNS = "id, plan_id, status, notes, submitted_at"


def trainee_receives_plan(conn, trainee_id, plan_id) -> bool:
    """True if the plan was assigned to this trainee directly or to a cohort they are in."""
    return conn.execute(
        """SELECT EXISTS (
             SELECT 1 FROM plan_assignments a
             WHERE a.plan_id = %s
               AND (a.trainee_id = %s
                    OR a.cohort_id IN (SELECT cohort_id FROM cohort_members WHERE trainee_id = %s))
           ) AS ok""",
        (plan_id, trainee_id, trainee_id),
    ).fetchone()["ok"]


def latest_status(conn, trainee_id, plan_id):
    row = conn.execute(
        """SELECT status FROM progress_reports WHERE trainee_id = %s AND plan_id = %s
           ORDER BY submitted_at DESC, id DESC LIMIT 1""",
        (trainee_id, plan_id),
    ).fetchone()
    return row["status"] if row else None


def create(conn, trainee_id, plan_id, status: str, notes):
    return conn.execute(
        f"""INSERT INTO progress_reports (plan_id, trainee_id, status, notes)
            VALUES (%s, %s, %s, %s) RETURNING {REPORT_COLUMNS}""",
        (plan_id, trainee_id, status, notes),
    ).fetchone()


def list_for_trainee_plan(conn, trainee_id, plan_id, limit: int, offset: int):
    items = conn.execute(
        f"""SELECT {REPORT_COLUMNS} FROM progress_reports
            WHERE trainee_id = %s AND plan_id = %s
            ORDER BY submitted_at DESC, id DESC LIMIT %s OFFSET %s""",
        (trainee_id, plan_id, limit, offset),
    ).fetchall()
    total = conn.execute(
        "SELECT count(*) AS n FROM progress_reports WHERE trainee_id = %s AND plan_id = %s",
        (trainee_id, plan_id),
    ).fetchone()["n"]
    return items, total


def list_for_plan(conn, plan_id, trainee_id, limit: int, offset: int):
    # The only varying part of the WHERE clause is a fixed fragment, never a user
    # value; every value stays a %s parameter.
    where = "r.plan_id = %s" + (" AND r.trainee_id = %s" if trainee_id else "")
    params = (plan_id, trainee_id) if trainee_id else (plan_id,)
    items = conn.execute(
        f"""SELECT r.id, r.status, r.notes, r.submitted_at,
                   u.id AS trainee_id, u.name AS trainee_name, u.email AS trainee_email
            FROM progress_reports r JOIN users u ON u.id = r.trainee_id
            WHERE {where} ORDER BY r.submitted_at DESC, r.id DESC LIMIT %s OFFSET %s""",
        params + (limit, offset),
    ).fetchall()
    total = conn.execute(
        f"SELECT count(*) AS n FROM progress_reports r WHERE {where}", params
    ).fetchone()["n"]
    return items, total
