"""Phase 9: the "only offer what's available" filters and the cohort-plans /
plan-assignments read endpoints."""

import uuid

from tests.test_plans import add_member, assign, db, new_cohort, new_plan, new_trainee, uniq


def deactivate(trainee_id):
    conn = db()
    conn.execute("UPDATE users SET active = false WHERE id = %s", (trainee_id,))
    conn.close()


def ids(body):
    return {i["id"] for i in body["items"]}


# ---------- GET /cohorts/{id} (cohort detail header) ----------

def test_get_cohort_permissions(client, hr_headers, manager_headers, trainee_headers):
    cohort = new_cohort(client, manager_headers)
    url = f"/cohorts/{cohort['id']}"
    assert client.get(url, headers=manager_headers).status_code == 200
    assert client.get(url, headers=hr_headers).status_code == 200  # staff: hr + manager
    assert client.get(url, headers=trainee_headers).status_code == 403
    assert client.get(url).status_code == 401


def test_get_cohort_unknown_is_404_bad_id_is_400(client, manager_headers):
    assert client.get(f"/cohorts/{uuid.uuid4()}", headers=manager_headers).status_code == 404
    assert client.get("/cohorts/not-a-uuid", headers=manager_headers).status_code == 400


def test_get_cohort_returns_name_and_active_member_count(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    members = [new_trainee(client, hr_headers) for _ in range(3)]
    for m in members:
        add_member(client, manager_headers, cohort["id"], m["id"])
    deactivate(members[0]["id"])  # count must exclude deactivated

    body = client.get(f"/cohorts/{cohort['id']}", headers=manager_headers).json()
    assert body["id"] == cohort["id"]
    assert body["name"] == cohort["name"]
    assert body["active_member_count"] == 2


# ---------- permissions on the new endpoints ----------

def test_cohort_plans_is_manager_only(client, hr_headers, manager_headers, trainee_headers):
    cohort = new_cohort(client, manager_headers)
    url = f"/cohorts/{cohort['id']}/plans"
    assert client.get(url, headers=manager_headers).status_code == 200
    assert client.get(url, headers=hr_headers).status_code == 403
    assert client.get(url, headers=trainee_headers).status_code == 403
    assert client.get(url).status_code == 401


def test_plan_assignments_is_manager_only(client, hr_headers, manager_headers, trainee_headers):
    plan = new_plan(client, manager_headers)
    url = f"/plans/{plan['id']}/assignments"
    assert client.get(url, headers=manager_headers).status_code == 200
    assert client.get(url, headers=hr_headers).status_code == 403
    assert client.get(url, headers=trainee_headers).status_code == 403
    assert client.get(url).status_code == 401


def test_trainee_filter_requires_staff(client, trainee_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    url = f"/trainees?not_in_cohort={cohort['id']}"
    assert client.get(url, headers=manager_headers).status_code == 200
    assert client.get(url, headers=trainee_headers).status_code == 403
    assert client.get(url).status_code == 401


# ---------- not_in_cohort: excludes members and deactivated ----------

def test_not_in_cohort_excludes_members_and_deactivated(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    free = new_trainee(client, hr_headers, "Free Person")
    member = new_trainee(client, hr_headers, "Member Person")
    gone = new_trainee(client, hr_headers, "Gone Person")
    add_member(client, manager_headers, cohort["id"], member["id"])
    deactivate(gone["id"])

    body = client.get(f"/trainees?not_in_cohort={cohort['id']}&limit=100", headers=manager_headers).json()
    got = ids(body)
    assert free["id"] in got
    assert member["id"] not in got  # already a member
    assert gone["id"] not in got    # deactivated


def test_everyone_in_cohort_yields_empty(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    t = new_trainee(client, hr_headers)
    add_member(client, manager_headers, cohort["id"], t["id"])
    # Filter to this test's single trainee + its cohort by searching the name.
    body = client.get(
        f"/trainees?not_in_cohort={cohort['id']}&q={t['name'].split()[0]}", headers=manager_headers
    ).json()
    assert t["id"] not in ids(body)


# ---------- not_assigned_plan on trainees (direct assignment) ----------

def test_not_assigned_plan_excludes_directly_assigned(client, hr_headers, manager_headers):
    plan = new_plan(client, manager_headers)
    assigned = new_trainee(client, hr_headers)
    free = new_trainee(client, hr_headers)
    assert assign(client, manager_headers, plan["id"], trainee_id=assigned["id"]).status_code == 201

    body = client.get(f"/trainees?not_assigned_plan={plan['id']}&limit=100", headers=manager_headers).json()
    got = ids(body)
    assert assigned["id"] not in got
    assert free["id"] in got


# ---------- not_assigned_cohort on plans ----------

def test_not_assigned_cohort_hides_only_that_cohorts_plans(client, manager_headers):
    c1 = new_cohort(client, manager_headers)
    c2 = new_cohort(client, manager_headers)
    p_here = new_plan(client, manager_headers)
    p_other = new_plan(client, manager_headers)
    p_free = new_plan(client, manager_headers)
    assign(client, manager_headers, p_here["id"], cohort_id=c1["id"])
    assign(client, manager_headers, p_other["id"], cohort_id=c2["id"])

    body = client.get(f"/plans?not_assigned_cohort={c1['id']}&limit=100", headers=manager_headers).json()
    got = ids(body)
    assert p_here["id"] not in got        # already on this cohort
    assert p_other["id"] in got           # on a DIFFERENT cohort -> still offered
    assert p_free["id"] in got            # unassigned -> offered


# ---------- not_assigned_plan on cohorts ----------

def test_not_assigned_plan_hides_cohorts_with_plan(client, manager_headers):
    plan = new_plan(client, manager_headers)
    has = new_cohort(client, manager_headers)
    free = new_cohort(client, manager_headers)
    assign(client, manager_headers, plan["id"], cohort_id=has["id"])

    body = client.get(f"/cohorts?not_assigned_plan={plan['id']}&limit=100", headers=manager_headers).json()
    got = ids(body)
    assert has["id"] not in got
    assert free["id"] in got


# ---------- cohort plans endpoint ----------

def test_cohort_plans_lists_plans_with_active_member_count(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    members = [new_trainee(client, hr_headers) for _ in range(3)]
    for m in members:
        add_member(client, manager_headers, cohort["id"], m["id"])
    deactivate(members[0]["id"])  # now 2 active members
    plan = new_plan(client, manager_headers)
    assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])

    body = client.get(f"/cohorts/{cohort['id']}/plans", headers=manager_headers).json()
    assert body["total"] == 1
    row = body["items"][0]
    assert row["id"] == plan["id"]
    assert row["active_member_count"] == 2
    assert "assigned_at" in row


def test_cohort_plans_unknown_cohort_is_404(client, manager_headers):
    assert client.get(f"/cohorts/{uuid.uuid4()}/plans", headers=manager_headers).status_code == 404


# ---------- plan assignments endpoint ----------

def test_plan_assignments_lists_cohorts_and_trainees(client, hr_headers, manager_headers):
    plan = new_plan(client, manager_headers)
    cohort = new_cohort(client, manager_headers)
    trainee = new_trainee(client, hr_headers)
    assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    assign(client, manager_headers, plan["id"], trainee_id=trainee["id"])

    body = client.get(f"/plans/{plan['id']}/assignments", headers=manager_headers).json()
    assert body["cohorts"]["total"] == 1
    assert body["cohorts"]["items"][0]["id"] == cohort["id"]
    assert body["trainees"]["total"] == 1
    assert body["trainees"]["items"][0]["id"] == trainee["id"]


def test_plan_assignments_unknown_plan_is_404(client, manager_headers):
    assert client.get(f"/plans/{uuid.uuid4()}/assignments", headers=manager_headers).status_code == 404


# ---------- validation ----------

def test_bad_uuid_filter_is_400(client, manager_headers):
    assert client.get("/trainees?not_in_cohort=not-a-uuid", headers=manager_headers).status_code == 400
    assert client.get("/plans?not_assigned_cohort=nope", headers=manager_headers).status_code == 400


def test_unknown_exclusion_id_excludes_nothing(client, hr_headers, manager_headers):
    # An exclusion filter naming a cohort that doesn't exist excludes nobody, so
    # the trainee still appears (an empty list would wrongly say "none available").
    t = new_trainee(client, hr_headers)
    body = client.get(
        f"/trainees?not_in_cohort={uuid.uuid4()}&limit=100", headers=manager_headers
    ).json()
    assert t["id"] in ids(body)


def test_new_endpoints_pagination_bounds(client, manager_headers):
    cohort = new_cohort(client, manager_headers)
    plan = new_plan(client, manager_headers)
    for url in (f"/cohorts/{cohort['id']}/plans", f"/plans/{plan['id']}/assignments"):
        assert client.get(f"{url}?limit=101", headers=manager_headers).status_code == 400
        assert client.get(f"{url}?offset=-1", headers=manager_headers).status_code == 400


# ---------- regression: assigning still notifies exactly active members ----------

def test_adding_plan_to_cohort_still_notifies_active_members(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    members = [new_trainee(client, hr_headers) for _ in range(3)]
    for m in members:
        add_member(client, manager_headers, cohort["id"], m["id"])
    deactivate(members[0]["id"])
    plan = new_plan(client, manager_headers)
    r = assign(client, manager_headers, plan["id"], cohort_id=cohort["id"])
    assert r.status_code == 201
    assert r.json()["notified"] == 2
    # Duplicate assignment is still a 409.
    assert assign(client, manager_headers, plan["id"], cohort_id=cohort["id"]).status_code == 409


# ---------- q search escapes LIKE wildcards ----------

def test_q_search_treats_wildcards_literally(client, hr_headers, manager_headers):
    cohort = new_cohort(client, manager_headers)
    tag = uniq()
    literal = new_trainee(client, hr_headers, f"Pct {tag} 50%off")
    other = new_trainee(client, hr_headers, f"Plain {tag} person")
    # "%" must match a literal percent sign, not act as a wildcard.
    body = client.get(
        f"/trainees?not_in_cohort={cohort['id']}&q=50%25off&limit=100", headers=manager_headers
    ).json()
    got = ids(body)
    assert literal["id"] in got
    assert other["id"] not in got
