from datetime import datetime, timedelta, timezone

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient

from app.config import get_settings
from app.core.errors import AppError, register_error_handlers
from app.dependencies import get_current_user, require_role


def login(client, email, password):
    return client.post("/auth/login", json={"email": email, "password": password})


def bearer(token):
    return {"Authorization": f"Bearer {token}"}


def test_health_reaches_database(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


@pytest.mark.parametrize(
    "email,password,role",
    [
        ("user@noticeboard.test", "user123", "trainee"),
        ("admin@noticeboard.test", "admin123", "manager"),
        ("humanresource@noticeboard.test", "humanresource123", "hr"),
    ],
)
def test_demo_users_can_log_in_and_hash_never_leaks(client, email, password, role):
    r = login(client, email, password)
    assert r.status_code == 200
    body = r.json()
    assert body["user"]["role"] == role
    assert body["token"]
    assert "password_hash" not in r.text
    assert "$2" not in r.text  # no bcrypt hash anywhere in the response


def test_email_is_case_insensitive(client):
    assert login(client, "  ADMIN@NoticeBoard.test ", "admin123").status_code == 200


def test_wrong_password_and_unknown_email_give_identical_error(client):
    a = login(client, "admin@noticeboard.test", "nope")
    b = login(client, "nobody@noticeboard.test", "nope")
    assert a.status_code == b.status_code == 401
    assert a.json() == b.json()


def test_bad_login_input_is_rejected_not_crashed_on(client):
    assert client.post("/auth/login", json={}).status_code == 400
    assert client.post("/auth/login", json={"email": ["x"], "password": {"a": 1}}).status_code == 400
    r = client.post("/auth/login", content="{bad", headers={"Content-Type": "application/json"})
    assert r.status_code == 400


def test_sql_injection_in_email_does_nothing(client):
    assert login(client, "' OR '1'='1", "x").status_code == 401


def test_overlong_password_is_rejected_safely(client):
    assert login(client, "admin@noticeboard.test", "a" * 100).status_code == 401


def test_protected_route_needs_a_valid_token(client):
    assert client.get("/auth/me").status_code == 401
    assert client.get("/auth/me", headers=bearer("garbage")).status_code == 401
    token = login(client, "user@noticeboard.test", "user123").json()["token"]
    r = client.get("/auth/me", headers=bearer(token))
    assert r.status_code == 200
    assert r.json()["user"]["email"] == "user@noticeboard.test"


def test_forged_and_expired_tokens_are_rejected(client):
    uid = login(client, "user@noticeboard.test", "user123").json()["user"]["id"]
    now = datetime.now(timezone.utc)
    forged = jwt.encode({"sub": uid, "exp": now + timedelta(hours=1)}, "x" * 40, algorithm="HS256")
    expired = jwt.encode(
        {"sub": uid, "exp": now - timedelta(minutes=1)}, get_settings().jwt_secret, algorithm="HS256"
    )
    assert client.get("/auth/me", headers=bearer(forged)).status_code == 401
    assert client.get("/auth/me", headers=bearer(expired)).status_code == 401


def test_deactivating_a_user_kills_their_existing_token(client, temp_user):
    temp_user.make()
    token = login(client, temp_user.email, temp_user.password).json()["token"]
    assert client.get("/auth/me", headers=bearer(token)).status_code == 200
    temp_user.conn.execute("UPDATE users SET active = false WHERE email = %s", (temp_user.email,))
    assert client.get("/auth/me", headers=bearer(token)).status_code == 401
    assert login(client, temp_user.email, temp_user.password).status_code == 401


def test_forced_password_change_flow(client, temp_user):
    temp_user.make(must_change=True)

    # A normal protected route (a throwaway app using the real dependency).
    mini = FastAPI()
    register_error_handlers(mini)

    @mini.get("/protected")
    def protected(user=Depends(get_current_user)):
        return {"ok": True}

    other = TestClient(mini)

    body = login(client, temp_user.email, temp_user.password).json()
    token = body["token"]
    assert body["user"]["must_change_password"] is True

    blocked = other.get("/protected", headers=bearer(token))
    assert blocked.status_code == 403
    assert blocked.json()["code"] == "PASSWORD_CHANGE_REQUIRED"

    def change(current, new):
        return client.post(
            "/auth/change-password",
            json={"current_password": current, "new_password": new},
            headers=bearer(token),
        )

    assert change(temp_user.password, "short").status_code == 400
    assert change("wrong-current", "a-good-new-pass").status_code == 401
    assert change(temp_user.password, temp_user.password).status_code == 400
    assert change(temp_user.password, "a-good-new-pass").status_code == 200

    assert login(client, temp_user.email, temp_user.password).status_code == 401  # old one is dead
    again = login(client, temp_user.email, "a-good-new-pass").json()
    assert again["user"]["must_change_password"] is False
    assert other.get("/protected", headers=bearer(again["token"])).status_code == 200

    stored = temp_user.conn.execute(
        "SELECT password_hash FROM users WHERE email = %s", (temp_user.email,)
    ).fetchone()[0]
    assert stored.startswith("$2")  # a bcrypt hash
    assert "a-good-new-pass" not in stored


def test_require_role_allows_listed_roles_and_blocks_others():
    check = require_role("hr", "manager")
    assert check(user={"role": "hr"})["role"] == "hr"
    assert check(user={"role": "manager"})["role"] == "manager"
    with pytest.raises(AppError) as err:
        check(user={"role": "trainee"})
    assert err.value.status_code == 403


def test_unknown_route_returns_json_404(client):
    r = client.get("/nope")
    assert r.status_code == 404
    assert "error" in r.json()


def test_security_headers_are_set(client):
    r = client.get("/health")
    assert r.headers["x-content-type-options"] == "nosniff"
    assert r.headers["x-frame-options"] == "DENY"


def test_repeated_failed_logins_get_rate_limited(client):
    statuses = [login(client, "admin@noticeboard.test", "wrong").status_code for _ in range(25)]
    assert 429 in statuses
    assert statuses.index(429) == 15  # exactly the configured limit
    # Even the right password is blocked while locked out.
    assert login(client, "admin@noticeboard.test", "admin123").status_code == 429
