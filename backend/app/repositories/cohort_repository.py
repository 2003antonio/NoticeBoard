"""The ONLY place that writes SQL about cohorts and their members."""


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


def add_member(conn, cohort_id, trainee_id) -> None:
    conn.execute(
        "INSERT INTO cohort_members (cohort_id, trainee_id) VALUES (%s, %s)", (cohort_id, trainee_id)
    )


def list_members(conn, cohort_id):
    return conn.execute(
        """SELECT u.id, u.name, u.email, u.active, m.added_at
           FROM cohort_members m JOIN users u ON u.id = m.trainee_id
           WHERE m.cohort_id = %s ORDER BY lower(u.name), u.id""",
        (cohort_id,),
    ).fetchall()
