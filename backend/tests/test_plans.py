import uuid
from datetime import date, timedelta

import psycopg
import pytest

from app.config import get_settings


# ---------- small helpers ----------

def uniq():
    return uuid.uuid4().hex[:8]


def db():
    return psycopg.connect(get_settings().database_url, autocommit=True)


def new_trainee(client, hr_headers, name="Test Person"):
    r = client.post("/trainees", json={"name": name, "email": f"test-{uniq()}@noticeboard.test"}, headers=hr_headers)
    assert r.status_code == 201, r.text
    return r.json()["trainee"]


def trainee_session(client, hr_headers, name="Test Person"):
    """Onboard a trainee and return (trainee, headers) for a usable login.

    A freshly onboarded trainee must change their temporary password before any
    route works, so we do that here. Their notification list starts empty, which
    keeps the notification tests independent of demo data.
    """
    r = client.post("/trainees", json={"name": name, "email": f"test-{uniq()}@noticeboard.test"}, headers=hr_headers)
    assert r.status_code == 201, r.text
    created = r.json()
    email, temp = created["trainee"]["email"], created["temporary_password"]
    token = client.post("/auth/login", json={"email": email, "password": temp}).json()["token"]
    h = {"Authorization": f"Bearer {token}"}
    client.post("/auth/change-password", json={"current_password": temp, "new_password": "set-password-1"}, headers=h)
    token = client.post("/auth/login", json={"email": email, "password": "set-password-1"}).json()["token"]
    return created["trainee"], {"Authorization": f"Bearer {token}"}


def new_cohort(client, manager_headers, name=None):
    name = name or f"Test Cohort {uniq()}"
    r = client.post("/cohorts", json={"name": name}, headers=manager_headers)
    assert r.status_code == 201, r.text
    return r.json()


def new_plan(client, manager_headers, title=None, due_date=None):
    title = title or f"Test Plan {uniq()}"
    body = {"title": title}
    if due_date is not None:
        body["due_date"] = due_date
    r = client.post("/plans", json=body, headers=manager_headers)
    assert r.status_code == 201, r.text
    return r.json()


def add_member(client, manager_headers, cohort_id, trainee_id):
    r = client.post(f"/cohorts/{cohort_id}/members", json={"trainee_id": trainee_id}, headers=manager_headers)
    assert r.status_code == 201, r.text


def assign(client, manager_headers, plan_id, *, cohort_id=None, trainee_id=None):
    body = {}
    if cohort_id is not None:
        body["cohort_id"] = cohort_id
    if trainee_id is not None:
        body["trainee_id"] = trainee_id
    return client.post(f"/plans/{plan_id}/assignments", json=body, headers=manager_headers)


def count_notifications(plan_id):
    conn = db()
    n = conn.execute("SELECT count(*) FROM notifications WHERE plan_id = %s", (plan_id,)).fetchone()[0]
    conn.close()
    return n


# ---------- plan permissions ----------

def test_plan_routes_are_manager_only(client, hr_headers, manager_headers, trainee_headers):
    # create
    assert client.post("/plans", json={"title": "Test Plan X"}, headers=hr_headers).status_code == 403
    assert client.post("/plans", json={"title": "Test Plan X"}, headers=trainee_headers).status_code == 403
    assert client.post("/plans", json={"title": "Test Plan X"}).status_code == 401
    plan = new_plan(client, manager_headers)
    # list + get
    for h in (hr_headers, trainee_headers):
        assert client.get("/plans", headers=h).status_code == 403
        assert client.get(f"/plans/{plan['id']}", headers=h).status_code == 403
    assert client.get("/plans").status_code == 401
    assert client.get(f"/plans/{plan['id']}").status_code == 401
    assert client.get("/plans", headers=manager_headers).status_code == 200
    assert client.get(f"/plans/{plan['id']}", headers=manager_headers).status_code == 200


# ---------- plan creation + validation ----------

def test_create_plan_returns_it(client, manager_headers):
    due = (date.today() + timedelta(days=5)).isoformat()
    body = client.post(
        "/plans",
        json={"title": "  Test Plan Trim  ", "description": "  do the thing  ", "due_date": due},
        headers=manager_headers,
    ).json()
    assert body["title"] == "Test Plan Trim"      # trimmed
    assert body["description"] == "do the thing"  # trimmed
    assert body["due_date"] == due
    assert "id" in body and "created_at" in body


def test_plan_description_and_due_date_are_optional(client, manager_headers):
    body = new_plan(client, manager_headers)
    assert body["description"] is None
    assert body["due_date"] is None


def test_due_date_today_is_allowed(client, manager_headers):
    today = date.today().isoformat()
    r = client.post("/plans", json={"title": f"Test Plan {uniq()}", "due_date": today}, headers=manager_headers)
    assert r.status_code == 201


@pytest.mark.parametrize(
    "payload,bad_field",
    [
        ({"title": "   "}, "title"),
        ({"title": ""}, "title"),
        ({}, "title"),
        ({"title": "A" * 201}, "title"),
        ({"title": "Test Plan ok", "description": "d" * 2001}, "description"),
        ({"title": "Test Plan ok", "due_date": "2000-01-01"}, "due_date"),
        ({"title": "Test Plan ok", "due_date": "not-a-date"}, "due_date"),
    ],
)
def test_bad_plan_input_is_rejected(client, manager_headers, payload, bad_field):
    r = client.post("/plans", json=payload, headers=manager_headers)
    assert r.status_code == 400
    assert bad_field in [d["field"] for d in r.json()["details"]]


def test_get_missing_plan_is_404(client, manager_headers):
    assert client.get(f"/plans/{uuid.uuid4()}", headers=manager_headers).status_code == 404


def test_plan_list_is_paginated(client, manager_headers):
    for _ in range(3):
        new_plan(client, manager_headers)
    r = client.get("/plans?limit=2", headers=manager_headers).json()
    assert len(r["items"]) == 2 and r["total"] >= 3
    assert client.get("/plans?limit=101", headers=manager_headers).status_code == 400
    assert client.get("/plans?offset=-1", headers=manager_headers).status_code == 400


# ---------- assignment permissions ----------

def test_assignment_route_is_manager_only(client, hr_headers, manager_headers, trainee_headers):
    plan = new_plan(client, manager_headers)
    cohort = new_cohort(client, manager_headers)
    body = {"cohort_id": cohort["id"]}
    url = f"/plans/{plan['id']}/assignments"
    assert client.post(url, json=body, headers=hr_headers).status_code == 403
    assert client.post(url, json=body, headers=trainee_headers).status_code == 403
    assert client.post(url, json=body).status_code == 401


# ---------- assignment target validation ----------

def test_assignment_needs_exactly_one_target(client, manager_headers):
    plan = new_plan(client, manager_headers)
    cohort = new_cohort(client, manager_headers)
    url = f"/plans/{plan['id']}/assignments"
    # neither
    assert client.post(url, json={}, headers=manager_headers).status_code == 400
    # both
    both = {"cohort_id": cohort["id"], "trainee_id": str(uuid.uuid4())}
    assert client.post(url, json=both, headers=manager_headers).status_code == 400


def test_assignment_rejects_bad_ids(client, hr_headers, manager_headers):
    plan = new_plan(client, manager_headers)
    missing = str(uuid.uuid4())
    # missing plan
    assert assign(client, manager_headers, missing, cohort_id=missing).status_code == 404
    # missing cohort
    assert assign(client, manager_headers, plan["id"], cohort_id=missing).status_code == 404
    # missing trainee
    assert assign(client, manager_headers, plan["id"], trainee_id=missing).status_code == 404
    # a non-trainee user (the manager) is "not found" as a trainee target
    me = client.get("/auth/me", headers=manager_headers).json()["user"]
    assert assign(client, manager_headers, plan["id"], trainee_id=me["id"]).status_code == 404
    # deactivated trainee -> 400
    t = new_trainee(client, hr_headers)
    conn = db()
    conn.execute("UPDATE users SET active = false WHERE id = %s", (t["id"],))
    conn.close()
    r = assign(client, manager_headers, plan["id"], trainee_id=t["id"])
    assert r.status_code == 400
    assert r.json()["error"] == "Trainee is deactivated"


# ---------- fan-out counts ----------

def test_cohort_assignment_notifies_every_active_member(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    members = [new_trainee(client, hr_headers) for _ in range(3)]
    for m in members:
        add_member(client, manager_headers, cohort["id"], m["id"])
    # deactivate one AFTER joining: they must be excluded from the fan-out
    conn = db()
    conn.execute("UPDATE users SET active = false WHERE id = %s", (members[0]["id"],))
    conn.close()

    plan = new_plan(client, manager_headers, due_date=(date.today() + timedelta(days=3)).isoformat())
    r = assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    assert r.status_code == 201
    assert r.json()["notified"] == 2            # 3 members minus 1 deactivated
    assert count_notifications(plan["id"]) == 2
    # the deactivated member got nothing
    conn = db()
    got = conn.execute(
        "SELECT count(*) FROM notifications WHERE plan_id = %s AND user_id = %s",
        (plan["id"], members[0]["id"]),
    ).fetchone()[0]
    conn.close()
    assert got == 0


def test_solo_assignment_notifies_one(client, hr_headers, manager_headers):
    t = new_trainee(client, hr_headers)
    plan = new_plan(client, manager_headers)
    r = assign(client, manager_headers, plan["id"], trainee_id=t["id"])
    assert r.status_code == 201
    assert r.json()["notified"] == 1
    assert count_notifications(plan["id"]) == 1


def test_empty_cohort_assignment_notifies_nobody(client, manager_headers):
    cohort = new_cohort(client, manager_headers)
    plan = new_plan(client, manager_headers)
    r = assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    assert r.status_code == 201
    assert r.json()["notified"] == 0
    assert count_notifications(plan["id"]) == 0


def test_notification_message_format(client, hr_headers, manager_headers):
    t = new_trainee(client, hr_headers)
    due = date.today() + timedelta(days=4)
    plan = new_plan(client, manager_headers, title=f"Test Plan {uniq()}", due_date=due.isoformat())
    assign(client, manager_headers, plan["id"], trainee_id=t["id"])
    conn = db()
    msg = conn.execute("SELECT message FROM notifications WHERE plan_id = %s", (plan["id"],)).fetchone()[0]
    conn.close()
    assert msg == f"New plan assigned: {plan['title']} (due {due.isoformat()})"

    # and without a due date, no suffix
    plan2 = new_plan(client, manager_headers)
    assign(client, manager_headers, plan2["id"], trainee_id=t["id"])
    conn = db()
    msg2 = conn.execute("SELECT message FROM notifications WHERE plan_id = %s", (plan2["id"],)).fetchone()[0]
    conn.close()
    assert msg2 == f"New plan assigned: {plan2['title']}"


# ---------- duplicate assignment ----------

def test_duplicate_assignment_is_409_and_adds_no_notifications(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    t = new_trainee(client, hr_headers)
    add_member(client, manager_headers, cohort["id"], t["id"])
    plan = new_plan(client, manager_headers)

    assert assign(client, manager_headers, plan["id"], cohort_id=cohort["id"]).status_code == 201
    assert count_notifications(plan["id"]) == 1
    r = assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    assert r.status_code == 409
    assert count_notifications(plan["id"]) == 1  # unchanged


# ---------- atomicity ----------

def test_assignment_is_all_or_nothing(client, hr_headers, manager_headers, monkeypatch):
    """If notifying fails after the assignment row is inserted, the whole request
    rolls back: no assignment and no notifications remain."""
    cohort = new_cohort(client, manager_headers)
    t = new_trainee(client, hr_headers)
    add_member(client, manager_headers, cohort["id"], t["id"])
    plan = new_plan(client, manager_headers)

    from app.repositories import plan_repository

    def boom(*args, **kwargs):
        raise RuntimeError("notification step failed")

    monkeypatch.setattr(plan_repository, "notify_cohort", boom)
    # The TestClient re-raises server-side exceptions, so the failure surfaces
    # here. The point is what it leaves behind: the request's transaction rolled
    # back, so neither the assignment nor any notification was committed.
    with pytest.raises(RuntimeError, match="notification step failed"):
        assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])

    conn = db()
    assignments = conn.execute(
        "SELECT count(*) FROM plan_assignments WHERE plan_id = %s", (plan["id"],)
    ).fetchone()[0]
    conn.close()
    assert assignments == 0
    assert count_notifications(plan["id"]) == 0


# ---------- late joiner ----------

def test_late_joiner_gets_existing_cohort_plans(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    plan_a = new_plan(client, manager_headers, due_date=(date.today() + timedelta(days=2)).isoformat())
    plan_b = new_plan(client, manager_headers)
    assign(client, manager_headers, plan_a["id"], cohort_id=cohort["id"])
    assign(client, manager_headers, plan_b["id"], cohort_id=cohort["id"])

    late, headers = trainee_session(client, hr_headers)
    add_member(client, manager_headers, cohort["id"], late["id"])

    feed = client.get("/notifications", headers=headers).json()
    assert feed["total"] == 2  # one per already-assigned plan
    assert {n["plan_id"] for n in feed["items"]} == {plan_a["id"], plan_b["id"]}


def test_joining_a_cohort_with_no_plans_notifies_nothing(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    late, headers = trainee_session(client, hr_headers)
    add_member(client, manager_headers, cohort["id"], late["id"])
    assert client.get("/notifications", headers=headers).json()["total"] == 0


# ---------- /my/plans ----------

def test_my_plans_shows_direct_and_cohort_without_duplicates(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    cohort = new_cohort(client, manager_headers)
    add_member(client, manager_headers, cohort["id"], me["id"])

    cohort_plan = new_plan(client, manager_headers)
    direct_plan = new_plan(client, manager_headers)
    both_plan = new_plan(client, manager_headers)

    assign(client, manager_headers, cohort_plan["id"], cohort_id=cohort["id"])
    assign(client, manager_headers, direct_plan["id"], trainee_id=me["id"])
    # reaches me both ways -> must appear once, source "direct"
    assign(client, manager_headers, both_plan["id"], cohort_id=cohort["id"])
    assign(client, manager_headers, both_plan["id"], trainee_id=me["id"])

    # a plan for someone else must never show up in my list
    other = new_trainee(client, hr_headers)
    other_plan = new_plan(client, manager_headers)
    assign(client, manager_headers, other_plan["id"], trainee_id=other["id"])

    items = client.get("/my/plans", headers=headers).json()["items"]
    by_id = {i["id"]: i for i in items}
    assert other_plan["id"] not in by_id
    assert len(items) == 3
    assert by_id[cohort_plan["id"]]["source"] == cohort["name"]
    assert by_id[direct_plan["id"]]["source"] == "direct"
    assert by_id[both_plan["id"]]["source"] == "direct"  # direct wins the tie


def test_my_plans_multi_cohort_source_is_alphabetical(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    suffix = uniq()
    cohort_a = new_cohort(client, manager_headers, name=f"Test Cohort AAA {suffix}")
    cohort_z = new_cohort(client, manager_headers, name=f"Test Cohort ZZZ {suffix}")
    add_member(client, manager_headers, cohort_a["id"], me["id"])
    add_member(client, manager_headers, cohort_z["id"], me["id"])

    plan = new_plan(client, manager_headers)
    # assigned via both cohorts, not directly -> alphabetically-first name wins
    assign(client, manager_headers, plan["id"], cohort_id=cohort_z["id"])
    assign(client, manager_headers, plan["id"], cohort_id=cohort_a["id"])

    items = client.get("/my/plans", headers=headers).json()["items"]
    mine = [i for i in items if i["id"] == plan["id"]]
    assert len(mine) == 1
    assert mine[0]["source"] == cohort_a["name"]


def test_my_plans_is_trainee_only(client, hr_headers, manager_headers):
    assert client.get("/my/plans", headers=hr_headers).status_code == 403
    assert client.get("/my/plans", headers=manager_headers).status_code == 403
    assert client.get("/my/plans").status_code == 401


# ---------- notifications feed ----------

def test_notifications_list_is_mine_only(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    other, other_headers = trainee_session(client, hr_headers)
    my_plan = new_plan(client, manager_headers)
    other_plan = new_plan(client, manager_headers)
    assign(client, manager_headers, my_plan["id"], trainee_id=me["id"])
    assign(client, manager_headers, other_plan["id"], trainee_id=other["id"])

    feed = client.get("/notifications", headers=headers).json()
    assert feed["total"] == 1
    assert {n["plan_id"] for n in feed["items"]} == {my_plan["id"]}


def test_notifications_any_logged_in_user(client, hr_headers, manager_headers, trainee_headers):
    for h in (hr_headers, manager_headers, trainee_headers):
        assert client.get("/notifications", headers=h).status_code == 200
    assert client.get("/notifications").status_code == 401


def test_unread_only_and_unread_count(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    plans = [new_plan(client, manager_headers) for _ in range(3)]
    for p in plans:
        assign(client, manager_headers, p["id"], trainee_id=me["id"])

    feed = client.get("/notifications", headers=headers).json()
    assert feed["total"] == 3 and feed["unread_count"] == 3

    # mark one read
    first = feed["items"][0]["id"]
    assert client.patch(f"/notifications/{first}/read", headers=headers).status_code == 200

    feed = client.get("/notifications", headers=headers).json()
    assert feed["total"] == 3 and feed["unread_count"] == 2   # total unchanged, unread drops

    unread = client.get("/notifications?unread_only=true", headers=headers).json()
    assert unread["total"] == 2 and unread["unread_count"] == 2
    assert all(n["is_read"] is False for n in unread["items"])


def test_unread_count_counts_beyond_the_page(client, hr_headers, manager_headers):
    """unread_count is the full unread total even when more notifications exist
    than fit on one page."""
    me, headers = trainee_session(client, hr_headers)
    for _ in range(3):
        p = new_plan(client, manager_headers)
        assign(client, manager_headers, p["id"], trainee_id=me["id"])

    page = client.get("/notifications?limit=2", headers=headers).json()
    assert len(page["items"]) == 2      # page is capped
    assert page["total"] == 3           # total across all pages
    assert page["unread_count"] == 3    # counts every unread, not just this page


def test_notifications_are_newest_first(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    first = new_plan(client, manager_headers)
    second = new_plan(client, manager_headers)
    assign(client, manager_headers, first["id"], trainee_id=me["id"])
    assign(client, manager_headers, second["id"], trainee_id=me["id"])
    items = client.get("/notifications", headers=headers).json()["items"]
    assert items[0]["plan_id"] == second["id"]  # most recent assignment on top


# ---------- mark read ----------

def test_cannot_mark_another_users_notification(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    other, other_headers = trainee_session(client, hr_headers)
    plan = new_plan(client, manager_headers)
    assign(client, manager_headers, plan["id"], trainee_id=other["id"])
    note_id = client.get("/notifications", headers=other_headers).json()["items"][0]["id"]

    # someone else's id looks exactly like a missing one: 404, no information leak
    assert client.patch(f"/notifications/{note_id}/read", headers=headers).status_code == 404
    # still unread for the real owner
    assert client.get("/notifications", headers=other_headers).json()["unread_count"] == 1


def test_marking_a_missing_notification_is_404(client, hr_headers):
    _, headers = trainee_session(client, hr_headers)
    assert client.patch(f"/notifications/{uuid.uuid4()}/read", headers=headers).status_code == 404


def test_mark_read_is_idempotent(client, hr_headers, manager_headers):
    me, headers = trainee_session(client, hr_headers)
    plan = new_plan(client, manager_headers)
    assign(client, manager_headers, plan["id"], trainee_id=me["id"])
    note_id = client.get("/notifications", headers=headers).json()["items"][0]["id"]

    r1 = client.patch(f"/notifications/{note_id}/read", headers=headers)
    r2 = client.patch(f"/notifications/{note_id}/read", headers=headers)
    assert r1.status_code == 200 and r2.status_code == 200
    assert r2.json()["is_read"] is True
    assert client.get("/notifications", headers=headers).json()["unread_count"] == 0
