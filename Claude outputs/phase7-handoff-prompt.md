# Task: build Phase 7 of NoticeBoardTracker (the manager dashboard)

You are continuing a project that is built and tested through Phase 6. Read this whole brief, then read the existing code before writing anything. Your first output must be a SHORT PLAN (files you will add or change, any schema change, how you will classify rows, open questions). Wait for my approval before implementing.

## 1. The project in one paragraph

NoticeBoardTracker is a full-stack platform for an EdTech organization. HR onboards new trainees. Training Managers assign training plans to trainees, mostly through group cohorts and occasionally to a single trainee. The system notifies trainees automatically, and trainees submit progress reports. It replaces scattered 1:1 messages and manual Excel tracking, and must prevent duplicated or missing trainees and give managers a high-level view of who is on track and who is falling behind. This phase builds that view. It is a solo workshop assignment AND a portfolio piece for a role using React + Python + AWS, so clear architecture and defensible queries matter as much as features.

## 2. Stack (do not change it)

- Python 3.12, FastAPI, PostgreSQL 16+, psycopg 3 (sync) with a connection pool, pydantic v2, pytest.
- No ORM, no async rewrite, no new dependencies unless you justify them in your plan. The React frontend comes later and is NOT part of this task.
- Code is in `backend/`. Run tests with `pytest` from `backend/` (venv at `backend/.venv`). Tests run against the database in `DATABASE_URL`.

## 3. Architecture rules (follow exactly)

Layers, each only calls the one below it:

- `app/routers/` (controllers): read the request, call a service, shape the response. No SQL, no business rules.
- `app/services/`: business rules. No HTTP objects, no SQL. Raise `AppError(status, message, code=None)` for expected failures.
- `app/repositories/`: the ONLY place SQL lives. Always parameterized (`%s`).
- `app/schemas/`: pydantic request and response models; every route uses `response_model`.
- `app/core/`: security, errors, rate limiting. `app/dependencies.py`: `get_current_user`, `require_role(...)`.

Conventions already in use (match them):

- Every service function takes the request's `conn` first. `get_db` gives one connection per request, one transaction.
- The database is the real guard (constraints, unique indexes); services translate violations into clear 4xx errors.
- IDs are UUIDs. Errors are `{"error": "..."}` with optional `code` or `details`. Validation errors are 400 with per-field `details`.
- Lists are paginated: `limit` 1..100 (default 50), `offset` >= 0, response `{items, total, limit, offset}`.
- Role checks happen server side on every route: 401 without a token, 403 for the wrong role.
- Reference style: `app/routers/plans.py`, `app/services/report_service.py`, `app/repositories/report_repository.py`, and `my_plans` in `app/repositories/plan_repository.py` (a good example of the "one row per plan, direct beats cohort" style of query).

## 4. Scalability expectations (these matter most this phase)

- Every dashboard number must come from set-based SQL (aggregates, CTEs, window functions or a view). No Python loops over trainees, plans or cohorts, and no N+1 queries.
- Assume thousands of trainees, tens of cohorts and hundreds of plans. Paginate every list. Use existing indexes or add the ones you need, and say why.
- Everything stays stateless; no caching layer, no background jobs. If you think caching or a materialized view would be needed at larger scale, write one line about it in `Architecture.md` under "Scaling notes" but do not build it.
- Prove it: write a throwaway script that loads roughly 5,000 trainees, 20 cohorts and 10 plans (with random reports) into a SEPARATE scratch database (not `noticeboard`), time each dashboard endpoint's SQL, and report the numbers to me. Delete that script and the scratch database when finished. Do not leave it in the repo.

## 5. Where we are

Done and tested (95 tests passing): schema and seed, login and roles, trainee onboarding, cohorts and members, plans, assignments, notifications (fan-out, late-joiner catch-up, feed), progress reports.

Tables you will use (see `backend/db/schema.sql`):

- `users` (role hr/manager/trainee, `active`)
- `cohorts`, `cohort_members(cohort_id, trainee_id, added_at)`
- `plans(id, title, due_date, ...)`
- `plan_assignments(plan_id, cohort_id XOR trainee_id, assigned_at)`
- `progress_reports(plan_id, trainee_id, status on_track|blocked|done, notes, submitted_at)`. Indexes: `(trainee_id, plan_id, submitted_at DESC)` and `(plan_id, submitted_at DESC)`. At most one `done` per trainee and plan; "done is final".

Demo logins: `admin@noticeboard.test` / `admin123` (manager), `humanresource@noticeboard.test` / `humanresource123`, `user@noticeboard.test` / `user123` (trainee). Seed data: one cohort "Cohort A" (3 trainees), one plan, one assignment, one report.

## 6. This pass: the model you must implement

### 6a. The unit being measured: a "recipient pair"

A recipient pair is one (trainee, plan) for an ACTIVE trainee who receives that plan, either directly or through any cohort they belong to. Each pair is counted ONCE, even if the plan reaches the trainee through several routes (this is the de-duplication the earlier notification design promised). Deactivated trainees are excluded everywhere. Cohorts with no members and plans with no recipients simply produce no pairs.

Baseline time for a pair (when the clock starts): the earliest of the routes' start times, where a direct route starts at `assigned_at`, and a cohort route starts at `GREATEST(assigned_at, cohort_members.added_at)` (a trainee who joined later is not "late" for time before they joined).

### 6b. Classification of each pair (decided, do not re-ask)

- `latest_status`: the status of the pair's most recent report (order by `submitted_at DESC, id DESC`), or `no_report` if none.
- `is_done`: latest_status is `done`.
- `is_overdue`: the plan has a due date earlier than today AND the pair is not done.
- `is_missing`: the pair is not done AND the last activity is more than 7 days ago, where last activity is the latest report's `submitted_at`, or the baseline time if there is no report. The 7 is one named constant/setting (`CHECKIN_DAYS`), defined in exactly one place.
- `needs_attention`: latest_status is `blocked`, OR is_overdue, OR is_missing.
- A done pair is never overdue, never missing, never needing attention.
- Flags are independent; a pair can be, for example, blocked AND overdue.

### 6c. Endpoints (all manager only; 401 / 403 otherwise)

1. `GET /dashboard/summary`: one object with counts over all pairs: `total_pairs`, `done`, `on_track`, `blocked`, `no_report`, `overdue`, `missing`, `needs_attention`, plus `active_trainees`, `cohorts` and `plans` totals, and `completion_percent` (done / total_pairs * 100, rounded to 1 decimal, 0 when there are no pairs). `on_track` means latest_status is on_track.
2. `GET /dashboard/cohorts` (paginated): one row per cohort with `cohort_id`, `name`, `member_count` (active members), `plan_count`, `total_pairs`, `done`, `blocked`, `overdue`, `missing`, `needs_attention`, `completion_percent`. Pairs here are the pairs reached THROUGH that cohort's members for plans assigned to that cohort (a trainee in two cohorts appears in both cohorts' rows, but only once in the global summary). Default order: needs_attention descending, then name.
3. `GET /dashboard/trainees` (paginated): the drill-down list of pairs: `trainee_id`, `trainee_name`, `trainee_email`, `plan_id`, `plan_title`, `due_date`, `latest_status`, `last_report_at`, `is_done`, `is_overdue`, `is_missing`, `needs_attention`, `source` (same direct-wins / alphabetical-cohort rule as `/my/plans`). Optional filters: `cohort_id`, `plan_id`, `trainee_id`, `attention_only=true`, `status` (one of the latest_status values). Default order: needs_attention first, then overdue, then oldest last activity, then trainee name.

All three must agree with each other (the summary equals the sum implied by the drill-down) and must be consistent with the rules in `Architecture.md` under "Progress reports: the rules".

### Out of scope

The React frontend, the Postman collection, email or push alerts, editing or deleting anything, changing any Phase 1-6 behavior or API contract, caching, background jobs. HR gets no dashboard access.

### Decisions already made (do not re-ask)

- Check-in window is 7 days; dashboard is manager only; done is final; the pair is (trainee, plan) not the assignment.
- You MAY add a SQL view or indexes if they make the queries clearer or faster; any schema change goes in `backend/db/schema.sql` (drop-and-recreate in dev) and `seed.sql` if needed. Tell me clearly if I must reload the database.

## 7. Testing requirements

Add tests in `backend/tests/` reusing the helpers in `tests/test_plans.py` (`trainee_session`, `new_cohort`, `new_plan`, `add_member`, `assign`) and the fixtures in `conftest.py`. Extend the autouse cleanup if you create new kinds of test data. Tests must never depend on or alter demo data: assert on DIFFERENCES from a baseline taken at the start of the test, or filter by the test's own cohort/plan ids. The whole suite (currently 95) must still pass.

Create aged data by setting `submitted_at` / `assigned_at` / `added_at` directly in the database inside the test; do not sleep.

Cover at least:

- Permissions on every endpoint for each role and no token.
- Each classification: done, blocked, on_track, no_report, overdue (due yesterday, not done), NOT overdue when done, missing (last report 8 days old; baseline 8 days old with no report), NOT missing at 6 days, a late joiner whose clock starts at `added_at`, deactivated trainee excluded.
- De-duplication: a trainee reaching a plan directly and through two cohorts counts once in the summary, and once per cohort in the cohort rows.
- Summary, cohort rows and drill-down agree with each other on the same test data.
- `completion_percent` rounding and the zero case; empty cohort; plan with no recipients.
- Filters (`cohort_id`, `plan_id`, `trainee_id`, `attention_only`, `status`), sort order, pagination bounds (limit 101 and offset -1 are 400).
- Bad filter values (not a UUID, unknown status) are 400, not 500. Unknown cohort or plan id in a filter returns an empty list, not an error (decide and document in your plan).
- Mutation checks on at least three rules (for example the 7-day threshold, the de-duplication, the active-trainee filter, and the "done is never overdue" rule): break each on purpose, confirm a test fails, restore, and tell me what you did.

## 8. Working rules

- Comments explain WHY in plain words. SQL is allowed to be sophisticated but every non-obvious clause (CTE, DISTINCT ON, window, LATERAL) needs a short comment saying what it computes. I will be asked to explain this code in interviews.
- Do not change existing endpoints' contracts or existing tests, except where genuinely required; tell me if so.
- Update `Architecture.md` (Done endpoints table, a short "Dashboard: how the numbers are computed" section in plain language) and the status checklist in `ReadMe.md`.
- Do not commit, push, touch `.env`, or create any prompt, note or scratch files in the repo. I commit myself as 2003antonio with short one-line messages.
- Security: server-side authorization on everything, parameterized SQL, bounded inputs, no stack traces or internals in responses.

## 9. When you finish, report in plain language (I get lost in jargon)

1. What now works, in a few sentences, as if explaining to a non-programmer, including exactly what "missing" and "overdue" mean.
2. How I can try it myself in `/docs` (which user, which calls, what I should see with the demo data, and how to create a late or blocked trainee to see the flags change).
3. What the tests prove and the results of your mutation checks.
4. The scale-test timings (rows loaded, time per endpoint) and anything you would add at larger scale.
5. Whether I need to reload the database, with Windows SQL Shell steps:
   `\c noticeboard` then `\i 'C:/Users/anton/OneDrive/Desktop/CitiBank/NoticeBoard/backend/db/schema.sql'` then the same for `seed.sql`.
6. Any assumption you made or question you want me to decide.
