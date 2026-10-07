"""The ONLY place that writes SQL about users. Values always go in as %s parameters."""

from app.repositories._search import like_contains

PUBLIC_COLUMNS = "id, name, email, role, active, must_change_password"


def get_by_email(conn, email: str):
    return conn.execute(
        f"SELECT {PUBLIC_COLUMNS}, password_hash FROM users WHERE lower(email) = %s",
        (email,),
    ).fetchone()


def get_by_id(conn, user_id):
    return conn.execute(
        f"SELECT {PUBLIC_COLUMNS} FROM users WHERE id = %s", (user_id,)
    ).fetchone()


def get_password_hash(conn, user_id) -> str:
    row = conn.execute("SELECT password_hash FROM users WHERE id = %s", (user_id,)).fetchone()
    return row["password_hash"]


def update_password(conn, user_id, password_hash: str) -> None:
    conn.execute(
        "UPDATE users SET password_hash = %s, must_change_password = false WHERE id = %s",
        (password_hash, user_id),
    )


TRAINEE_COLUMNS = "id, name, email, active, created_at"


def create_trainee(conn, name: str, email: str, password_hash: str):
    # New trainees must change their temporary password at first login.
    return conn.execute(
        f"""INSERT INTO users (name, email, password_hash, role, must_change_password)
            VALUES (%s, %s, %s, 'trainee', true) RETURNING {TRAINEE_COLUMNS}""",
        (name, email, password_hash),
    ).fetchone()


def get_trainee(conn, user_id):
    return conn.execute(
        f"SELECT {TRAINEE_COLUMNS} FROM users WHERE id = %s AND role = 'trainee'", (user_id,)
    ).fetchone()


def list_trainees(conn, limit: int, offset: int, not_in_cohort=None, not_assigned_plan=None, q=None):
    """List trainees, newest-name-first. The optional filters power the "only
    offer what's available" pickers:
      - not_in_cohort: exclude trainees already in that cohort (and deactivated).
      - not_assigned_plan: exclude trainees already assigned that plan directly
        (and deactivated), for the plan page's direct-assign picker.
      - q: case-insensitive name/email contains-search.
    Each clause is a fixed SQL fragment chosen by a flag; every value is a %s param.
    When no filter is given the behaviour is exactly as before.
    """
    where = ["role = 'trainee'"]
    params = []
    # Both pickers only ever want someone who could actually be added/assigned,
    # so either filter also drops deactivated users.
    if not_in_cohort is not None:
        where.append("active")
        # Anti-join: not already a member of this cohort (uses cohort_members PK).
        where.append("NOT EXISTS (SELECT 1 FROM cohort_members m WHERE m.cohort_id = %s AND m.trainee_id = users.id)")
        params.append(not_in_cohort)
    if not_assigned_plan is not None:
        where.append("active")
        # Anti-join: not already DIRECTLY assigned this plan (uses the partial
        # unique index on (plan_id, trainee_id)). Cohort reach is intentionally
        # ignored -- a trainee in an assigned cohort may still be assigned directly.
        where.append("NOT EXISTS (SELECT 1 FROM plan_assignments a WHERE a.plan_id = %s AND a.trainee_id = users.id)")
        params.append(not_assigned_plan)
    if q:
        where.append("(name ILIKE %s OR email ILIKE %s)")
        pattern = like_contains(q)
        params.extend([pattern, pattern])

    clause = " AND ".join(where)
    items = conn.execute(
        f"""SELECT {TRAINEE_COLUMNS} FROM users WHERE {clause}
            ORDER BY lower(name), id LIMIT %s OFFSET %s""",
        (*params, limit, offset),
    ).fetchall()
    total = conn.execute(f"SELECT count(*) AS n FROM users WHERE {clause}", tuple(params)).fetchone()["n"]
    return items, total
