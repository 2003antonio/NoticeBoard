import uuid

import psycopg
import pytest

from app.config import get_settings
from tests.test_plans import add_member, assign, db, new_cohort, new_plan, trainee_session, uniq


def report(client, headers, plan_id, status="on_track", notes=None):
    body = {"status": status}
    if notes is not None:
        body["notes"] = notes
    return client.post(f"/my/plans/{plan_id}/reports", json=body, headers=headers)


def setup_cohort_plan(client, hr_headers, manager_headers):
    """A trainee in a cohort that has been assigned a plan. Returns (trainee, headers, plan, cohort)."""
    trainee, headers = trainee_session(client, hr_headers)
    cohort = new_cohort(client, manager_headers)
    add_member(client, manager_headers, cohort["id"], trainee["id"])
    plan = new_plan(client, manager_headers)
    assert assign(client, manager_headers, plan["id"], cohort_id=cohort["id"]).status_code == 201
    return trainee, headers, plan, cohort


# ---------- submitting ----------

def test_trainee_reports_on_a_cohort_plan(client, hr_headers, manager_headers):
    trainee, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    r = report(client, h, plan["id"], "on_track", "  Finished module 1  ")
    assert r.status_code == 201
    body = r.json()
    assert body["plan_id"] == plan["id"]
    assert body["status"] == "on_track"
    assert body["notes"] == "Finished module 1"  # trimmed


def test_trainee_reports_on_a_directly_assigned_plan(client, hr_headers, manager_headers):
    trainee, h = trainee_session(client, hr_headers)
    plan = new_plan(client, manager_headers)
    assert assign(client, manager_headers, plan["id"], trainee_id=trainee["id"]).status_code == 201
    assert report(client, h, plan["id"]).status_code == 201


def test_notes_are_optional_unless_blocked(client, hr_headers, manager_headers):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    assert report(client, h, plan["id"], "on_track").status_code == 201
    assert report(client, h, plan["id"], "on_track", "   ").status_code == 201  # blank = no notes
    r = report(client, h, plan["id"], "blocked")  # "notes" not sent at all
    assert r.status_code == 400
    assert "notes" in [d["field"] for d in r.json()["details"]]
    assert report(client, h, plan["id"], "blocked", "   ").status_code == 400
    assert report(client, h, plan["id"], "blocked", "Waiting on VPN access").status_code == 201


@pytest.mark.parametrize(
    "payload",
    [{}, {"status": "finished"}, {"status": ""}, {"status": "on_track", "notes": "x" * 2001}, {"status": 5}],
)
def test_bad_report_input_is_rejected(client, hr_headers, manager_headers, payload):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    r = client.post(f"/my/plans/{plan['id']}/reports", json=payload, headers=h)
    assert r.status_code == 400


def test_cannot_report_on_a_plan_that_is_not_mine(client, hr_headers, manager_headers):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    _, other_h = trainee_session(client, hr_headers)  # not in the cohort
    unassigned = new_plan(client, manager_headers)
    missing = str(uuid.uuid4())

    results = {
        "someone else's plan": report(client, other_h, plan["id"]),
        "my plan, never assigned": report(client, h, unassigned["id"]),
        "no such plan": report(client, h, missing),
    }
    for name, r in results.items():
        assert r.status_code == 404, name
    # Same answer for all three, so nothing leaks about which plans exist.
    assert len({r.json()["error"] for r in results.values()}) == 1
    assert client.post("/my/plans/not-a-uuid/reports", json={"status": "done"}, headers=h).status_code == 400


def test_only_trainees_can_submit_reports(client, hr_headers, manager_headers):
    _, _, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    body = {"status": "on_track"}
    url = f"/my/plans/{plan['id']}/reports"
    assert client.post(url, json=body, headers=manager_headers).status_code == 403
    assert client.post(url, json=body, headers=hr_headers).status_code == 403
    assert client.post(url, json=body).status_code == 401


def test_done_is_final(client, hr_headers, manager_headers):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    assert report(client, h, plan["id"], "on_track").status_code == 201
    assert report(client, h, plan["id"], "done", "All finished").status_code == 201
    for status, notes in (("on_track", None), ("blocked", "oops"), ("done", None)):
        r = report(client, h, plan["id"], status, notes)
        assert r.status_code == 409
        assert r.json()["error"] == "This plan is already marked done"
    assert client.get(f"/my/plans/{plan['id']}/reports", headers=h).json()["total"] == 2


def test_done_is_per_plan(client, hr_headers, manager_headers):
    trainee, h = trainee_session(client, hr_headers)
    p1, p2 = new_plan(client, manager_headers), new_plan(client, manager_headers)
    for p in (p1, p2):
        assign(client, manager_headers, p["id"], trainee_id=trainee["id"])
    assert report(client, h, p1["id"], "done").status_code == 201
    assert report(client, h, p2["id"], "on_track").status_code == 201


def test_two_cohorts_and_direct_still_give_one_history(client, hr_headers, manager_headers):
    trainee, h = trainee_session(client, hr_headers)
    plan = new_plan(client, manager_headers)
    for _ in range(2):
        c = new_cohort(client, manager_headers)
        add_member(client, manager_headers, c["id"], trainee["id"])
        assign(client, manager_headers, plan["id"], cohort_id=c["id"])
    assign(client, manager_headers, plan["id"], trainee_id=trainee["id"])

    assert report(client, h, plan["id"], "on_track").status_code == 201
    assert report(client, h, plan["id"], "done").status_code == 201
    assert report(client, h, plan["id"], "on_track").status_code == 409  # final across all three routes
    assert client.get(f"/my/plans/{plan['id']}/reports", headers=h).json()["total"] == 2


# ---------- the database guards the same rules ----------

def test_database_allows_only_one_done_report(client, hr_headers, manager_headers):
    trainee, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    assert report(client, h, plan["id"], "done").status_code == 201
    conn = db()
    with pytest.raises(psycopg.errors.UniqueViolation):
        conn.execute(
            "INSERT INTO progress_reports (plan_id, trainee_id, status) VALUES (%s, %s, 'done')",
            (plan["id"], trainee["id"]),
        )
    conn.close()


def test_database_rejects_blocked_without_notes(client, hr_headers, manager_headers):
    trainee, _, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    conn = db()
    with pytest.raises(psycopg.errors.CheckViolation):
        conn.execute(
            "INSERT INTO progress_reports (plan_id, trainee_id, status, notes) VALUES (%s, %s, 'blocked', '  ')",
            (plan["id"], trainee["id"]),
        )
    conn.close()


# ---------- my history ----------

def test_my_history_is_newest_first_paginated_and_only_mine(client, hr_headers, manager_headers):
    trainee, h, plan, cohort = setup_cohort_plan(client, hr_headers, manager_headers)
    other, other_h = trainee_session(client, hr_headers)
    add_member(client, manager_headers, cohort["id"], other["id"])  # same plan, other person

    for note in ("one", "two", "three"):
        assert report(client, h, plan["id"], "on_track", note).status_code == 201
    assert report(client, other_h, plan["id"], "on_track", "not mine").status_code == 201

    url = f"/my/plans/{plan['id']}/reports"
    body = client.get(url, headers=h).json()
    assert [r["notes"] for r in body["items"]] == ["three", "two", "one"]
    assert body["total"] == 3

    page = client.get(url + "?limit=2&offset=2", headers=h).json()
    assert [r["notes"] for r in page["items"]] == ["one"] and page["total"] == 3
    assert client.get(url + "?limit=101", headers=h).status_code == 400
    assert client.get(url + "?offset=-1", headers=h).status_code == 400


def test_my_history_is_trainee_only_and_plan_scoped(client, hr_headers, manager_headers):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    _, other_h = trainee_session(client, hr_headers)
    url = f"/my/plans/{plan['id']}/reports"
    assert client.get(url, headers=other_h).status_code == 404  # not their plan
    assert client.get(url, headers=manager_headers).status_code == 403
    assert client.get(url).status_code == 401


def test_my_plans_shows_latest_report(client, hr_headers, manager_headers):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    item = client.get("/my/plans", headers=h).json()["items"][0]
    assert item["latest_status"] is None and item["last_report_at"] is None

    report(client, h, plan["id"], "on_track")
    report(client, h, plan["id"], "blocked", "stuck")
    item = client.get("/my/plans", headers=h).json()["items"][0]
    assert item["latest_status"] == "blocked"
    assert item["last_report_at"] is not None
    assert item["source"] and item["title"] == plan["title"]  # existing fields unchanged


# ---------- manager view ----------

def test_manager_sees_all_reports_for_a_plan_with_names(client, hr_headers, manager_headers):
    t1, h1, plan, cohort = setup_cohort_plan(client, hr_headers, manager_headers)
    t2, h2 = trainee_session(client, hr_headers, name="Second Person")
    add_member(client, manager_headers, cohort["id"], t2["id"])
    report(client, h1, plan["id"], "on_track", "a")
    report(client, h2, plan["id"], "blocked", "b")
    report(client, h1, plan["id"], "done", "c")

    url = f"/plans/{plan['id']}/reports"
    body = client.get(url, headers=manager_headers).json()
    assert body["total"] == 3
    assert [r["notes"] for r in body["items"]] == ["c", "b", "a"]
    names = {r["trainee_name"] for r in body["items"]}
    assert names == {"Test Person", "Second Person"}
    assert all(r["trainee_email"].startswith("test-") for r in body["items"])
    assert "password" not in str(body) and "$2" not in str(body)

    only_t2 = client.get(f"{url}?trainee_id={t2['id']}", headers=manager_headers).json()
    assert only_t2["total"] == 1 and only_t2["items"][0]["notes"] == "b"
    assert client.get(f"{url}?limit=1&offset=1", headers=manager_headers).json()["items"][0]["notes"] == "b"
    assert client.get(f"{url}?trainee_id=nope", headers=manager_headers).status_code == 400


def test_manager_report_view_permissions_and_missing_plan(client, hr_headers, manager_headers, trainee_headers):
    _, _, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    url = f"/plans/{plan['id']}/reports"
    assert client.get(url, headers=hr_headers).status_code == 403
    assert client.get(url, headers=trainee_headers).status_code == 403
    assert client.get(url).status_code == 401
    assert client.get(f"/plans/{uuid.uuid4()}/reports", headers=manager_headers).status_code == 404
    assert client.get(url, headers=manager_headers).json() == {"items": [], "total": 0, "limit": 50, "offset": 0}


def test_deleting_a_plan_removes_its_reports(client, hr_headers, manager_headers):
    _, h, plan, _ = setup_cohort_plan(client, hr_headers, manager_headers)
    report(client, h, plan["id"])
    conn = db()
    conn.execute("DELETE FROM plans WHERE id = %s", (plan["id"],))
    left = conn.execute("SELECT count(*) FROM progress_reports WHERE plan_id = %s", (plan["id"],)).fetchone()[0]
    conn.close()
    assert left == 0
