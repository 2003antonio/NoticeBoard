import uuid

import psycopg
import pytest

from app.config import get_settings


def uniq():
    return uuid.uuid4().hex[:8]


def new_trainee(client, headers, name="Test Person"):
    r = client.post("/trainees", json={"name": name, "email": f"test-{uniq()}@noticeboard.test"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def new_cohort(client, headers):
    r = client.post("/cohorts", json={"name": f"Test Cohort {uniq()}"}, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


# ---------- onboarding ----------

def test_hr_onboards_trainee_with_one_time_password(client, hr_headers):
    email = f"test-{uniq()}@noticeboard.test"
    r = client.post("/trainees", json={"name": "  Ana Perez ", "email": email.upper()}, headers=hr_headers)
    assert r.status_code == 201
    assert r.headers["cache-control"] == "no-store"
    body = r.json()
    assert body["trainee"]["name"] == "Ana Perez"
    assert body["trainee"]["email"] == email  # stored lowercase
    assert len(body["temporary_password"]) >= 8
    assert "password_hash" not in r.text

    # The temporary password works once, and forces a change.
    login = client.post("/auth/login", json={"email": email, "password": body["temporary_password"]})
    assert login.status_code == 200
    assert login.json()["user"]["must_change_password"] is True
    assert login.json()["user"]["role"] == "trainee"

    # Only a hash is stored.
    conn = psycopg.connect(get_settings().database_url, autocommit=True)
    stored = conn.execute("SELECT password_hash FROM users WHERE email = %s", (email,)).fetchone()[0]
    conn.close()
    assert stored.startswith("$2") and body["temporary_password"] not in stored


def test_two_onboarded_trainees_get_different_passwords(client, hr_headers):
    a = new_trainee(client, hr_headers)
    b = new_trainee(client, hr_headers)
    assert a["temporary_password"] != b["temporary_password"]
    assert a["trainee"]["id"] != b["trainee"]["id"]


def test_duplicate_email_is_rejected_even_with_different_case(client, hr_headers):
    email = f"test-{uniq()}@noticeboard.test"
    assert client.post("/trainees", json={"name": "A", "email": email}, headers=hr_headers).status_code == 201
    for variant in (email, email.upper(), f"  {email} "):
        r = client.post("/trainees", json={"name": "B", "email": variant}, headers=hr_headers)
        assert r.status_code == 409
        assert r.json()["error"] == "A user with this email already exists"


def test_cannot_reuse_a_demo_users_email(client, hr_headers):
    r = client.post("/trainees", json={"name": "X", "email": "admin@noticeboard.test"}, headers=hr_headers)
    assert r.status_code == 409


@pytest.mark.parametrize(
    "payload,bad_field",
    [
        ({"name": "A", "email": "not-an-email"}, "email"),
        ({"name": "A", "email": "a@b"}, "email"),
        ({"name": "   ", "email": "test-x@noticeboard.test"}, "name"),
        ({"email": "test-x@noticeboard.test"}, "name"),
        ({"name": "A" * 101, "email": "test-x@noticeboard.test"}, "name"),
    ],
)
def test_bad_onboarding_input_is_rejected_with_field_details(client, hr_headers, payload, bad_field):
    r = client.post("/trainees", json=payload, headers=hr_headers)
    assert r.status_code == 400
    assert bad_field in [d["field"] for d in r.json()["details"]]


def test_only_hr_can_onboard(client, manager_headers, trainee_headers):
    payload = {"name": "Nope", "email": f"test-{uniq()}@noticeboard.test"}
    assert client.post("/trainees", json=payload, headers=manager_headers).status_code == 403
    assert client.post("/trainees", json=payload, headers=trainee_headers).status_code == 403
    assert client.post("/trainees", json=payload).status_code == 401


# ---------- listing ----------

def test_hr_and_manager_can_list_trainees_but_trainees_cannot(client, hr_headers, manager_headers, trainee_headers):
    new_trainee(client, hr_headers)
    for h in (hr_headers, manager_headers):
        r = client.get("/trainees", headers=h)
        assert r.status_code == 200
        body = r.json()
        assert body["total"] >= 4  # 3 demo trainees + the one just made
        assert all(i["email"] for i in body["items"])
        assert "password" not in r.text and "$2" not in r.text
    assert client.get("/trainees", headers=trainee_headers).status_code == 403
    assert client.get("/trainees").status_code == 401


def test_trainee_list_is_paginated_and_limits_are_enforced(client, hr_headers):
    for _ in range(3):
        new_trainee(client, hr_headers)
    page1 = client.get("/trainees?limit=2&offset=0", headers=hr_headers).json()
    page2 = client.get("/trainees?limit=2&offset=2", headers=hr_headers).json()
    assert len(page1["items"]) == 2
    assert not {i["id"] for i in page1["items"]} & {i["id"] for i in page2["items"]}
    assert client.get("/trainees?limit=1000", headers=hr_headers).status_code == 400
    assert client.get("/trainees?limit=0", headers=hr_headers).status_code == 400
    assert client.get("/trainees?offset=-1", headers=hr_headers).status_code == 400


def test_list_does_not_include_managers_or_hr(client, hr_headers):
    emails = [i["email"] for i in client.get("/trainees?limit=100", headers=hr_headers).json()["items"]]
    assert "admin@noticeboard.test" not in emails
    assert "humanresource@noticeboard.test" not in emails


# ---------- forced password change on a real route ----------

def test_new_trainee_is_locked_out_of_everything_until_password_changed(client, hr_headers):
    created = new_trainee(client, hr_headers)
    email = created["trainee"]["email"]
    token = client.post(
        "/auth/login", json={"email": email, "password": created["temporary_password"]}
    ).json()["token"]
    h = {"Authorization": f"Bearer {token}"}

    r = client.get("/cohorts", headers=h)
    assert r.status_code == 403
    assert r.json()["code"] == "PASSWORD_CHANGE_REQUIRED"  # blocked before the role check

    r = client.post(
        "/auth/change-password",
        json={"current_password": created["temporary_password"], "new_password": "my-own-password"},
        headers=h,
    )
    assert r.status_code == 200
    assert client.post("/auth/login", json={"email": email, "password": created["temporary_password"]}).status_code == 401
    assert client.post("/auth/login", json={"email": email, "password": "my-own-password"}).status_code == 200


# ---------- cohorts ----------

def test_hr_and_manager_can_create_cohorts_trainees_cannot(client, hr_headers, manager_headers, trainee_headers):
    assert client.post("/cohorts", json={"name": f"Test Cohort {uniq()}"}, headers=hr_headers).status_code == 201
    assert client.post("/cohorts", json={"name": f"Test Cohort {uniq()}"}, headers=manager_headers).status_code == 201
    assert client.post("/cohorts", json={"name": "Test Cohort Z"}, headers=trainee_headers).status_code == 403
    assert client.post("/cohorts", json={"name": "Test Cohort Z"}).status_code == 401


def test_duplicate_cohort_name_rejected_case_insensitively(client, manager_headers):
    name = f"Test Cohort {uniq()}"
    assert client.post("/cohorts", json={"name": name}, headers=manager_headers).status_code == 201
    for variant in (name, name.lower(), name.upper(), f"  {name}  "):
        r = client.post("/cohorts", json={"name": variant}, headers=manager_headers)
        assert r.status_code == 409, variant
    assert client.post("/cohorts", json={"name": "   "}, headers=manager_headers).status_code == 400


def test_add_members_and_see_them_immediately(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    t1 = new_trainee(client, hr_headers, "Zed Test")["trainee"]
    t2 = new_trainee(client, hr_headers, "Amy Test")["trainee"]

    r = client.post(f"/cohorts/{cohort['id']}/members", json={"trainee_id": t1["id"]}, headers=manager_headers)
    assert r.status_code == 201
    assert [m["id"] for m in r.json()["items"]] == [t1["id"]]
    client.post(f"/cohorts/{cohort['id']}/members", json={"trainee_id": t2["id"]}, headers=hr_headers)

    members = client.get(f"/cohorts/{cohort['id']}/members", headers=manager_headers).json()["items"]
    assert [m["name"] for m in members] == ["Amy Test", "Zed Test"]  # sorted by name
    assert "password" not in str(members)

    listed = client.get("/cohorts?limit=100", headers=manager_headers).json()["items"]
    assert next(c for c in listed if c["id"] == cohort["id"])["member_count"] == 2


def test_same_trainee_cannot_join_a_cohort_twice(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    t = new_trainee(client, hr_headers)["trainee"]
    url = f"/cohorts/{cohort['id']}/members"
    assert client.post(url, json={"trainee_id": t["id"]}, headers=manager_headers).status_code == 201
    r = client.post(url, json={"trainee_id": t["id"]}, headers=manager_headers)
    assert r.status_code == 409
    assert len(client.get(url, headers=manager_headers).json()["items"]) == 1


def test_trainee_can_be_in_several_cohorts(client, hr_headers, manager_headers):
    t = new_trainee(client, hr_headers)["trainee"]
    for _ in range(2):
        c = new_cohort(client, manager_headers)
        assert client.post(f"/cohorts/{c['id']}/members", json={"trainee_id": t["id"]}, headers=manager_headers).status_code == 201


def test_add_member_rejects_bad_targets(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    url = f"/cohorts/{cohort['id']}/members"
    missing = str(uuid.uuid4())

    assert client.post(f"/cohorts/{missing}/members", json={"trainee_id": missing}, headers=manager_headers).status_code == 404
    assert client.post(url, json={"trainee_id": missing}, headers=manager_headers).status_code == 404
    assert client.post(url, json={"trainee_id": "not-a-uuid"}, headers=manager_headers).status_code == 400
    assert client.post(url, json={}, headers=manager_headers).status_code == 400

    # A manager or HR user is not a trainee and cannot be added.
    me = client.get("/auth/me", headers=manager_headers).json()["user"]
    assert client.post(url, json={"trainee_id": me["id"]}, headers=manager_headers).status_code == 404

    # Deactivated trainees cannot be added.
    t = new_trainee(client, hr_headers)["trainee"]
    conn = psycopg.connect(get_settings().database_url, autocommit=True)
    conn.execute("UPDATE users SET active = false WHERE id = %s", (t["id"],))
    conn.close()
    r = client.post(url, json={"trainee_id": t["id"]}, headers=manager_headers)
    assert r.status_code == 400
    assert r.json()["error"] == "Trainee is deactivated"


def test_member_endpoints_are_staff_only(client, manager_headers, trainee_headers):
    cohort = new_cohort(client, manager_headers)
    url = f"/cohorts/{cohort['id']}/members"
    assert client.get(url, headers=trainee_headers).status_code == 403
    assert client.post(url, json={"trainee_id": str(uuid.uuid4())}, headers=trainee_headers).status_code == 403
    assert client.get(url).status_code == 401
    assert client.get("/cohorts", headers=trainee_headers).status_code == 403


def test_cohort_list_is_paginated(client, manager_headers):
    for _ in range(3):
        new_cohort(client, manager_headers)
    r = client.get("/cohorts?limit=2", headers=manager_headers).json()
    assert len(r["items"]) == 2 and r["total"] >= 4
    assert client.get("/cohorts?limit=101", headers=manager_headers).status_code == 400
