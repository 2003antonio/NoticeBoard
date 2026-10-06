# Tests run against the database in DATABASE_URL (seeded with seed.sql).
# They only create and remove one temporary user.
import os
from types import SimpleNamespace

os.environ.setdefault("JWT_SECRET", "test-secret-test-secret-test-secret-1234")
os.environ["LOGIN_RATE_LIMIT"] = "15"

import psycopg
import pytest
from fastapi.testclient import TestClient

from app.config import get_settings
from app.core.rate_limit import login_limiter
from app.core.security import hash_password

TEMP_EMAIL = "tmp-test@noticeboard.test"
TEMP_PASSWORD = "temp-pass-1"


@pytest.fixture(scope="session")
def client():
    from app.main import app

    with TestClient(app) as c:
        yield c


@pytest.fixture(autouse=True)
def fresh_rate_limiter():
    login_limiter.reset()
    yield


@pytest.fixture
def temp_user():
    conn = psycopg.connect(get_settings().database_url, autocommit=True)

    def make(active=True, must_change=False):
        conn.execute("DELETE FROM users WHERE email = %s", (TEMP_EMAIL,))
        row = conn.execute(
            """INSERT INTO users (name, email, password_hash, role, active, must_change_password)
               VALUES ('Temp', %s, %s, 'trainee', %s, %s) RETURNING id""",
            (TEMP_EMAIL, hash_password(TEMP_PASSWORD), active, must_change),
        ).fetchone()
        return str(row[0])

    yield SimpleNamespace(make=make, conn=conn, email=TEMP_EMAIL, password=TEMP_PASSWORD)
    conn.execute("DELETE FROM users WHERE email = %s", (TEMP_EMAIL,))
    conn.close()
