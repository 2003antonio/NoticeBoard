from datetime import date, timedelta

import pytest

from tests.test_plans import add_member, assign, db, new_cohort, new_plan, trainee_session, uniq


# ---------- helpers ----------

def report(client, headers, plan_id, status="on_track", notes=None):
    body = {"status": status}
    if notes is not None:
        body["notes"] = notes
    r = client.post(f"/my/plans/{plan_id}/reports", json=body, headers=headers)
    assert r.status_code == 201, r.text
    return r.json()


def drill(client, manager_headers, **q):
    qs = "&".join(f"{k}={v}" for k, v in q.items())
    url = "/dashboard/trainees" + (f"?{qs}" if qs else "")
    r = client.get(url, headers=manager_headers)
    assert r.status_code == 200, r.text
    return r.json()


def one_pair(client, manager_headers, plan_id, trainee_id):
    body = drill(client, manager_headers, plan_id=plan_id, trainee_id=trainee_id)
    assert body["total"] == 1, body
    return body["items"][0]


def cohort_row(client, manager_headers, cohort_id):
    # Only this test's cohorts plus the demo one exist (autouse cleanup), so one
    # page of 100 always contains our row.
    rows = client.get("/dashboard/cohorts?limit=100", headers=manager_headers).json()["items"]
    for row in rows:
        if row["cohort_id"] == cohort_id:
            return row
    raise AssertionError(f"cohort {cohort_id} not found in dashboard")


def set_due_yesterday(plan_id):
    # The API refuses to create a plan already past due, so we age the due date in
    # the database to simulate a plan whose deadline has since passed.
    conn = db()
    conn.execute("UPDATE plans SET due_date = CURRENT_DATE - 1 WHERE id = %s", (plan_id,))
    conn.close()


def solo_pair(client, hr_headers, manager_headers, due_yesterday=False):
    """A trainee with a plan assigned directly to them. Returns (trainee, headers, plan)."""
    trainee, headers = trainee_session(client, hr_headers)
    plan = new_plan(client, manager_headers)
    assert assign(client, manager_headers, plan["id"], trainee_id=trainee["id"]).status_code == 201
    if due_yesterday:
        set_due_yesterday(plan["id"])
    return trainee, headers, plan


def age_report(plan_id, trainee_id, days):
    conn = db()
    conn.execute(
        "UPDATE progress_reports SET submitted_at = now() - make_interval(days => %s) "
        "WHERE plan_id = %s AND trainee_id = %s",
        (days, plan_id, trainee_id),
    )
    conn.close()


def age_direct_assignment(plan_id, trainee_id, days):
    conn = db()
    conn.execute(
        "UPDATE plan_assignments SET assigned_at = now() - make_interval(days => %s) "
        "WHERE plan_id = %s AND trainee_id = %s",
        (days, plan_id, trainee_id),
    )
    conn.close()


def age_cohort_assignment(plan_id, cohort_id, days):
    conn = db()
    conn.execute(
        "UPDATE plan_assignments SET assigned_at = now() - make_interval(days => %s) "
        "WHERE plan_id = %s AND cohort_id = %s",
        (days, plan_id, cohort_id),
    )
    conn.close()


def age_membership(cohort_id, trainee_id, days):
    conn = db()
    conn.execute(
        "UPDATE cohort_members SET added_at = now() - make_interval(days => %s) "
        "WHERE cohort_id = %s AND trainee_id = %s",
        (days, cohort_id, trainee_id),
    )
    conn.close()


def deactivate(trainee_id):
    conn = db()
    conn.execute("UPDATE users SET active = false WHERE id = %s", (trainee_id,))
    conn.close()


YESTERDAY = (date.today() - timedelta(days=1)).isoformat()
TOMORROW = (date.today() + timedelta(days=1)).isoformat()


# ---------- permissions ----------

@pytest.mark.parametrize("path", ["/dashboard/summary", "/dashboard/cohorts", "/dashboard/trainees"])
def test_dashboard_is_manager_only(client, hr_headers, manager_headers, trainee_headers, path):
    assert client.get(path, headers=manager_headers).status_code == 200
    assert client.get(path, headers=hr_headers).status_code == 403
    assert client.get(path, headers=trainee_headers).status_code == 403
    assert client.get(path).status_code == 401


# ---------- classification ----------

def test_no_report_recent_assignment_is_quiet(client, hr_headers, manager_headers):
    trainee, _h, plan = solo_pair(client, hr_headers, manager_headers)
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["latest_status"] == "no_report"
    assert p["last_report_at"] is None
    assert not p["is_overdue"] and not p["is_missing"] and not p["needs_attention"]


def test_on_track_report(client, hr_headers, manager_headers):
    trainee, h, plan = solo_pair(client, hr_headers, manager_headers)
    report(client, h, plan["id"], "on_track")
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["latest_status"] == "on_track" and not p["needs_attention"]


def test_blocked_needs_attention(client, hr_headers, manager_headers):
    trainee, h, plan = solo_pair(client, hr_headers, manager_headers)
    report(client, h, plan["id"], "blocked", "Waiting on VPN")
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["latest_status"] == "blocked" and p["needs_attention"] and not p["is_done"]


def test_done(client, hr_headers, manager_headers):
    trainee, h, plan = solo_pair(client, hr_headers, manager_headers)
    report(client, h, plan["id"], "done")
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["is_done"] and p["latest_status"] == "done" and not p["needs_attention"]


def test_overdue_when_due_passed_and_not_done(client, hr_headers, manager_headers):
    trainee, _h, plan = solo_pair(client, hr_headers, manager_headers, due_yesterday=True)
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["is_overdue"] and p["needs_attention"]


def test_done_is_never_overdue(client, hr_headers, manager_headers):
    trainee, h, plan = solo_pair(client, hr_headers, manager_headers, due_yesterday=True)
    report(client, h, plan["id"], "done")
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["is_done"] and not p["is_overdue"] and not p["is_missing"] and not p["needs_attention"]


def test_missing_when_last_report_is_eight_days_old(client, hr_headers, manager_headers):
    trainee, h, plan = solo_pair(client, hr_headers, manager_headers)
    report(client, h, plan["id"], "on_track")
    age_report(plan["id"], trainee["id"], 8)
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["is_missing"] and p["needs_attention"]


def test_missing_when_no_report_and_baseline_eight_days_old(client, hr_headers, manager_headers):
    trainee, _h, plan = solo_pair(client, hr_headers, manager_headers)
    age_direct_assignment(plan["id"], trainee["id"], 8)  # clock started 8 days ago
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert p["latest_status"] == "no_report" and p["is_missing"]


def test_not_missing_at_six_days(client, hr_headers, manager_headers):
    trainee, h, plan = solo_pair(client, hr_headers, manager_headers)
    report(client, h, plan["id"], "on_track")
    age_report(plan["id"], trainee["id"], 6)
    p = one_pair(client, manager_headers, plan["id"], trainee["id"])
    assert not p["is_missing"]


def test_late_joiner_clock_starts_at_added_at(client, hr_headers, manager_headers):
    # Plan assigned to the cohort 30 days ago, but the trainee joined only 2 days
    # ago: their clock starts when they joined, so they are NOT missing yet.
    trainee, _h = trainee_session(client, hr_headers)
    cohort = new_cohort(client, manager_headers)
    plan = new_plan(client, manager_headers)
    assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    age_cohort_assignment(plan["id"], cohort["id"], 30)
    add_member(client, manager_headers, cohort["id"], trainee["id"])
    age_membership(cohort["id"], trainee["id"], 2)
    assert not one_pair(client, manager_headers, plan["id"], trainee["id"])["is_missing"]

    # Move their join date to 10 days ago -> now missing.
    age_membership(cohort["id"], trainee["id"], 10)
    assert one_pair(client, manager_headers, plan["id"], trainee["id"])["is_missing"]


def test_deactivated_trainee_is_excluded(client, hr_headers, manager_headers):
    trainee, _h, plan = solo_pair(client, hr_headers, manager_headers)
    assert drill(client, manager_headers, plan_id=plan["id"])["total"] == 1
    deactivate(trainee["id"])
    assert drill(client, manager_headers, plan_id=plan["id"])["total"] == 0


# ---------- de-duplication ----------

def test_pair_counts_once_in_summary_but_once_per_cohort(client, hr_headers, manager_headers):
    trainee, _h = trainee_session(client, hr_headers)
    c1 = new_cohort(client, manager_headers)
    c2 = new_cohort(client, manager_headers)
    add_member(client, manager_headers, c1["id"], trainee["id"])
    add_member(client, manager_headers, c2["id"], trainee["id"])
    plan = new_plan(client, manager_headers)
    assign(client, manager_headers, plan["id"], cohort_id=c1["id"])
    assign(client, manager_headers, plan["id"], cohort_id=c2["id"])
    assign(client, manager_headers, plan["id"], trainee_id=trainee["id"])  # also directly

    # Once globally for this (trainee, plan), and source is "direct" (direct wins).
    body = drill(client, manager_headers, plan_id=plan["id"], trainee_id=trainee["id"])
    assert body["total"] == 1
    assert body["items"][0]["source"] == "direct"

    # But present in each cohort's row.
    assert cohort_row(client, manager_headers, c1["id"])["total_pairs"] == 1
    assert cohort_row(client, manager_headers, c2["id"])["total_pairs"] == 1


def test_multi_route_missing_shows_in_both_cohorts_once_in_summary(client, hr_headers, manager_headers):
    # Reached through Cohort A long ago (no report -> missing), then later added to
    # Cohort B which has the same plan. Because one global classification is reused,
    # the pair is missing in BOTH cohort rows and counted once in the summary.
    missing_before = client.get("/dashboard/summary", headers=manager_headers).json()["missing"]

    trainee, _h = trainee_session(client, hr_headers)
    c_a = new_cohort(client, manager_headers)
    c_b = new_cohort(client, manager_headers)
    plan = new_plan(client, manager_headers)

    # Cohort A: assigned and joined 20 days ago -> clock is 20 days old, no report.
    assign(client, manager_headers, plan["id"], cohort_id=c_a["id"])
    add_member(client, manager_headers, c_a["id"], trainee["id"])
    age_cohort_assignment(plan["id"], c_a["id"], 20)
    age_membership(c_a["id"], trainee["id"], 20)

    # Cohort B: assigned and joined just now.
    assign(client, manager_headers, plan["id"], cohort_id=c_b["id"])
    add_member(client, manager_headers, c_b["id"], trainee["id"])

    assert one_pair(client, manager_headers, plan["id"], trainee["id"])["is_missing"]
    # Exactly ONE new missing pair in the global summary, despite two cohort routes.
    missing_after = client.get("/dashboard/summary", headers=manager_headers).json()["missing"]
    assert missing_after - missing_before == 1
    assert drill(client, manager_headers, plan_id=plan["id"], trainee_id=trainee["id"])["total"] == 1
    # ...and missing in BOTH cohort rows.
    assert cohort_row(client, manager_headers, c_a["id"])["missing"] == 1
    assert cohort_row(client, manager_headers, c_b["id"])["missing"] == 1


# ---------- agreement ----------

def test_summary_agrees_with_drilldown(client, hr_headers, manager_headers):
    # Build a mixed dataset, then prove the global summary equals the counts
    # derived from the full (unfiltered) drill-down -- demo data is on both sides.
    t1, h1, p1 = solo_pair(client, hr_headers, manager_headers, due_yesterday=True)  # overdue
    report(client, h1, p1["id"], "blocked", "stuck")                                 # blocked + overdue
    t2, h2, p2 = solo_pair(client, hr_headers, manager_headers)
    report(client, h2, p2["id"], "done")                                             # done
    t3, _h3, p3 = solo_pair(client, hr_headers, manager_headers)                     # no_report

    # Pull every pair via pagination.
    items, offset = [], 0
    while True:
        page = drill(client, manager_headers, limit=100, offset=offset)
        items += page["items"]
        offset += 100
        if offset >= page["total"]:
            break

    s = client.get("/dashboard/summary", headers=manager_headers).json()
    assert s["total_pairs"] == len(items)
    assert s["done"] == sum(i["is_done"] for i in items)
    assert s["blocked"] == sum(i["latest_status"] == "blocked" for i in items)
    assert s["on_track"] == sum(i["latest_status"] == "on_track" for i in items)
    assert s["no_report"] == sum(i["latest_status"] == "no_report" for i in items)
    assert s["overdue"] == sum(i["is_overdue"] for i in items)
    assert s["missing"] == sum(i["is_missing"] for i in items)
    assert s["needs_attention"] == sum(i["needs_attention"] for i in items)


# ---------- completion_percent / empty cases ----------

def test_cohort_completion_percent_rounding(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    trainees = []
    for _ in range(3):
        t, h = trainee_session(client, hr_headers)
        add_member(client, manager_headers, cohort["id"], t["id"])
        trainees.append((t, h))
    plan = new_plan(client, manager_headers)
    assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    # One of three done -> 33.3
    report(client, trainees[0][1], plan["id"], "done")

    row = cohort_row(client, manager_headers, cohort["id"])
    assert row["total_pairs"] == 3 and row["done"] == 1
    assert row["completion_percent"] == 33.3


def test_empty_cohort_and_plan_with_no_recipients(client, hr_headers, manager_headers):
    empty = new_cohort(client, manager_headers)
    row = cohort_row(client, manager_headers, empty["id"])
    assert row["member_count"] == 0 and row["total_pairs"] == 0
    assert row["completion_percent"] == 0.0

    unassigned = new_plan(client, manager_headers)  # never assigned
    assert drill(client, manager_headers, plan_id=unassigned["id"])["total"] == 0


# ---------- filters ----------

def test_filters_narrow_results(client, hr_headers, manager_headers):
    t1, h1, p1 = solo_pair(client, hr_headers, manager_headers, due_yesterday=True)
    report(client, h1, p1["id"], "blocked", "stuck")  # blocked + overdue -> attention
    t2, h2, p2 = solo_pair(client, hr_headers, manager_headers)
    report(client, h2, p2["id"], "on_track")

    assert drill(client, manager_headers, plan_id=p1["id"])["total"] == 1
    assert drill(client, manager_headers, trainee_id=t2["id"])["total"] == 1
    assert drill(client, manager_headers, status="blocked", plan_id=p1["id"])["total"] == 1
    assert drill(client, manager_headers, status="on_track", plan_id=p1["id"])["total"] == 0
    # attention_only keeps p1 (blocked+overdue) and drops p2 (on_track)
    att = drill(client, manager_headers, attention_only="true")
    ids = {i["plan_id"] for i in att["items"]}
    assert p1["id"] in ids and p2["id"] not in ids


def test_cohort_filter_only_returns_that_cohorts_pairs(client, hr_headers, manager_headers):
    t, _h = trainee_session(client, hr_headers)
    c1 = new_cohort(client, manager_headers)
    c2 = new_cohort(client, manager_headers)
    add_member(client, manager_headers, c1["id"], t["id"])
    add_member(client, manager_headers, c2["id"], t["id"])
    p1 = new_plan(client, manager_headers)
    p2 = new_plan(client, manager_headers)
    assign(client, manager_headers, p1["id"], cohort_id=c1["id"])
    assign(client, manager_headers, p2["id"], cohort_id=c2["id"])

    got = drill(client, manager_headers, cohort_id=c1["id"], trainee_id=t["id"])
    assert {i["plan_id"] for i in got["items"]} == {p1["id"]}


def test_unknown_filter_ids_return_empty_not_error(client, manager_headers):
    missing = str(uniq()) and "00000000-0000-0000-0000-000000000000"
    for key in ("cohort_id", "plan_id", "trainee_id"):
        r = client.get(f"/dashboard/trainees?{key}={missing}", headers=manager_headers)
        assert r.status_code == 200 and r.json()["total"] == 0


def test_bad_filter_values_are_400(client, manager_headers):
    assert client.get("/dashboard/trainees?plan_id=not-a-uuid", headers=manager_headers).status_code == 400
    assert client.get("/dashboard/trainees?status=whatever", headers=manager_headers).status_code == 400


def test_sort_puts_attention_first(client, hr_headers, manager_headers):
    t1, h1, p1 = solo_pair(client, hr_headers, manager_headers)
    report(client, h1, p1["id"], "on_track")             # quiet
    t2, h2, p2 = solo_pair(client, hr_headers, manager_headers, due_yesterday=True)  # overdue
    # Fetch both via a trainee filter won't work (different trainees); filter by plan set.
    items = drill(client, manager_headers, attention_only="false")["items"]
    # Among our two, the overdue one must appear before the on_track one.
    order = [i["plan_id"] for i in items if i["plan_id"] in (p1["id"], p2["id"])]
    assert order.index(p2["id"]) < order.index(p1["id"])


@pytest.mark.parametrize("path", ["/dashboard/cohorts", "/dashboard/trainees"])
def test_pagination_bounds(client, manager_headers, path):
    assert client.get(f"{path}?limit=101", headers=manager_headers).status_code == 400
    assert client.get(f"{path}?limit=0", headers=manager_headers).status_code == 400
    assert client.get(f"{path}?offset=-1", headers=manager_headers).status_code == 400
