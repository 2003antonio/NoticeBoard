"""The ONLY place that writes SQL about users. Values always go in as %s parameters."""

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


def list_trainees(conn, limit: int, offset: int):
    items = conn.execute(
        f"""SELECT {TRAINEE_COLUMNS} FROM users WHERE role = 'trainee'
            ORDER BY lower(name), id LIMIT %s OFFSET %s""",
        (limit, offset),
    ).fetchall()
    total = conn.execute("SELECT count(*) AS n FROM users WHERE role = 'trainee'").fetchone()["n"]
    return items, total
