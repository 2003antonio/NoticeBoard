# Architecture

## The big picture (plain language)

```
Browser (React)  -->  FastAPI  -->  PostgreSQL
   screens             rules + login    stored data
```

React shows screens. Every action goes to the FastAPI backend, which checks who you are and what your role allows, applies the business rules, then reads or writes PostgreSQL.

## Backend layers (MVC for an API)

| Layer | Folder | Job | May talk to |
|---|---|---|---|
| Controller | `app/routers/` | Read the request, call a service, shape the response | services, schemas |
| Service | `app/services/` | Business rules (e.g. "assign plan, then notify every trainee") | repositories |
| Model / data access | `app/repositories/` | The only place SQL lives | the database |
| Schemas | `app/schemas/` | What goes in and out of the API. Hides fields like the password hash | |
| Core | `app/core/` | Security, errors, rate limiting | |

Rule: each layer only calls the one below it. Routers never write SQL; repositories never know about HTTP. The View in MVC is the React frontend.

## Security built in

- Passwords stored as bcrypt hashes, never plain text
- New accounts get a random temporary password and must change it before doing anything else
- Random UUIDs as ids (not guessable)
- Same error for wrong password and unknown email; failed logins are rate limited
- Every request re-checks the user in the database, so deactivating an account works immediately
- All SQL uses parameters, never string-building
- Errors never expose internals to the client

## Database tables

| Table | Purpose | Key rules |
|---|---|---|
| `users` | Everyone who logs in | `email` unique (case-insensitive); role is hr, manager or trainee |
| `cohorts` | A group of trainees | `name` unique (case-insensitive) |
| `cohort_members` | Which trainee is in which cohort | pair is unique: no duplicate membership |
| `plans` | A training plan | created by a manager; title, description, due date |
| `plan_assignments` | Plan given to a cohort OR a single trainee | exactly one target; no duplicate assignment |
| `notifications` | Messages shown to a trainee | user, message, read flag, optional `plan_id` link |
| `progress_reports` | Trainee updates on a plan | plan, trainee, status (on_track, blocked, done), notes; blocked needs notes; at most one `done` per trainee and plan |

## API endpoints

Done:

| Method | Path | Who | What |
|---|---|---|---|
| GET | /health | anyone | server and database are up |
| POST | /auth/login | anyone | get a token |
| GET | /auth/me | logged in | who am I |
| POST | /auth/change-password | logged in | change my password |
| POST | /trainees | hr | onboard a trainee (409 if email exists); returns a one-time temporary password |
| GET | /trainees | hr, manager | list trainees (paginated) |
| POST | /cohorts | hr, manager | create cohort (409 if name exists, any capitalization) |
| GET | /cohorts | hr, manager | list cohorts with member counts (paginated) |
| POST | /cohorts/{id}/members | hr, manager | add a trainee to a cohort (409 if already in it); catches a late joiner up on the cohort's existing plans |
| GET | /cohorts/{id}/members | hr, manager | list a cohort's members |
| POST | /plans | manager | create plan (title, optional description and due date) |
| GET | /plans | manager | list plans (paginated) |
| GET | /plans/{id} | manager | one plan (404 if missing) |
| POST | /plans/{id}/assignments | manager | assign to a cohort OR one trainee; notifies recipients in the same transaction |
| GET | /notifications | any logged-in user | my notifications, newest first, paginated, `unread_only`, `unread_count` |
| PATCH | /notifications/{id}/read | owner | mark my notification read (idempotent; 404 for anyone else's) |
| GET | /my/plans | trainee | plans assigned to me, directly or via a cohort, each once, with my latest report status |
| POST | /my/plans/{id}/reports | trainee | submit a progress update on one of my plans (404 if it is not mine; 409 once marked done) |
| GET | /my/plans/{id}/reports | trainee | my own update history for a plan, newest first (paginated) |
| GET | /plans/{id}/reports | manager | every trainee's updates on a plan, newest first (paginated, optional `trainee_id` filter) |
| GET | /dashboard/summary | manager | one object of counts over all recipient pairs (done, blocked, overdue, missing, needs_attention, completion %) |
| GET | /dashboard/cohorts | manager | one row per cohort with its pair counts and completion % (paginated) |
| GET | /dashboard/trainees | manager | the drill-down list of (trainee, plan) pairs with flags; filters `cohort_id`, `plan_id`, `trainee_id`, `attention_only`, `status` (paginated) |

Planned:

| Method | Path | Who | What |
|---|---|---|---|
| — | React screens per role | all | the frontend |
| — | Postman collection | — | final docs |

### Notification fan-out and the "once" rules

- Assigning a plan to a cohort notifies every **active** member in one set-based
  `INSERT ... SELECT`, never a Python loop, so a cohort of thousands is still one query.
- Adding a member to a cohort catches them up on plans already assigned to it (one
  set-based insert), in the same transaction as the membership. Assigning a plan and
  adding a member to the same cohort first take a `FOR UPDATE` lock on the cohort row,
  so they run as turns and a new member is never skipped by a concurrent fan-out.
- The notification message is built in SQL in one shared place, so all three paths
  (cohort assign, solo assign, late joiner) produce the identical text.
- `/my/plans` shows each plan once. If a plan reaches a trainee more than one way, a
  **direct** assignment wins; otherwise the **alphabetically-first cohort name** wins.
  `/my/plans` is intentionally **not paginated** — one trainee's plan count is naturally
  bounded.
- A trainee assigned the same plan both directly and via a cohort does get two
  notifications; the future dashboard de-duplicates by (trainee, plan).

## Progress reports: the rules

- A report belongs to a **trainee and a plan**, not to one assignment. A plan can reach a trainee several ways (directly, through two cohorts); they still have one history, and the dashboard will count them once per (trainee, plan).
- Status is `on_track`, `blocked` or `done`. `blocked` must include notes saying what is blocking them (checked by the API and again by the database).
- **Done is final.** After a `done` report, further reports on that plan get a 409. The database also allows only one `done` per trainee and plan, so two submissions at the same instant cannot both win.
- A trainee can only report on a plan that reaches them. A plan that does not exist, and a plan that belongs to someone else, return the same 404 so nothing is revealed.
- Late and missing (used by the dashboard): a trainee is **missing** when they are not done and have not reported in the last 7 days (counted from the assignment if they have never reported). They are **overdue** once the plan's due date has passed without a `done` report.

## Dashboard: how the numbers are computed

The dashboard measures **recipient pairs**. A pair is one (active trainee, plan) the trainee receives — directly, or through any cohort they belong to — counted **once** even if the plan reaches them several ways. Deactivated trainees are excluded everywhere.

Every number comes from one shared SQL definition of a pair, so the three endpoints can never disagree. For each pair we work out:

- **latest_status** — the status of their most recent report on that plan, or `no_report` if they have never reported.
- **done** — their latest report is `done`. Done is final: a done pair is never overdue, missing or needing attention.
- **overdue** — the plan's due date has passed and the pair is not done.
- **missing** — not done, and there has been no activity for more than **7 days** (the one check-in window, `CHECKIN_DAYS`). "Activity" is their last report; if they have never reported, the clock starts at the **baseline time** — the earliest moment the plan reached them. A trainee who joined a cohort after a plan was assigned is not counted as late for the time before they joined.
- **needs_attention** — blocked, overdue or missing. Flags are independent: a pair can be blocked *and* overdue.

**One global classification, reused for cohort rows.** A trainee in two cohorts is counted once in the summary and the drill-down, but once in **each** cohort's row (so a cohort row sums its own members). Because the same global classification is reused, the baseline is always the earliest route across all of a trainee's cohorts. So a trainee who got a plan through Cohort A long ago (and never reported) shows as **missing in both Cohort A's and Cohort B's rows** even if they joined Cohort B only yesterday — they already had the plan, so their clock started with Cohort A. They are still counted once in the summary.

**completion_percent** is `done / total_pairs × 100`, rounded to one decimal, and `0` when there are no pairs. Filters that name an unknown cohort, plan or trainee simply return an empty list (not an error); a malformed id or an unknown `status` value is a 400.

## Scaling notes

- Login tokens are stateless, so many copies of the API can run behind a load balancer
- Config comes from environment variables, so the same code runs locally and on AWS
- Planned AWS shape: React on S3 + CloudFront, API on Lambda or a container, PostgreSQL on RDS
- The login rate limiter is in memory (fine for one server); with several servers it moves to Redis or the API gateway
- Notification fan-out is synchronous set-based SQL today; at larger scale it would move to a queue (for example SQS) so the API responds immediately and a background worker delivers the notifications.
- The dashboard recomputes the recipient pairs on every request from set-based SQL. At ~5,000 trainees every endpoint stays well under ~300 ms; if the pair count grew by another order of magnitude the shared pair definition would become a **materialized view** refreshed on a short schedule (the API already reads it as one relation, so only the refresh would be added).

## Build order

1. Schema + seed data (done)
2. Login + role checks (done)
3. Trainees + cohorts (done)
4. Plans + assignment + notifications (done)
5. Progress reports (done)
6. Dashboard (done)
7. React screens per role
8. Postman collection + final docs
