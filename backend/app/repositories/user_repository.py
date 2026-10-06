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
