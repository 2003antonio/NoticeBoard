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
| `notifications` | Messages shown to a trainee | user, message, read flag |
| `progress_reports` | Trainee updates | assignment, trainee, status, notes |

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
| POST | /cohorts/{id}/members | hr, manager | add a trainee to a cohort (409 if already in it) |
| GET | /cohorts/{id}/members | hr, manager | list a cohort's members |

Planned:

| Method | Path | Who | What |
|---|---|---|---|
| POST | /plans | manager | create plan |
| POST | /plans/{id}/assign | manager | assign to a cohort or a trainee; notifies them |
| GET | /notifications | trainee | my notifications |
| PATCH | /notifications/{id}/read | trainee | mark read |
| GET | /my/plans | trainee | plans assigned to me |
| POST | /reports | trainee | submit progress |
| GET | /dashboard | manager | per-cohort progress, late and missing reports |

## Scaling notes

- Login tokens are stateless, so many copies of the API can run behind a load balancer
- Config comes from environment variables, so the same code runs locally and on AWS
- Planned AWS shape: React on S3 + CloudFront, API on Lambda or a container, PostgreSQL on RDS
- The login rate limiter is in memory (fine for one server); with several servers it moves to Redis or the API gateway

## Build order

1. Schema + seed data (done)
2. Login + role checks (done)
3. Trainees + cohorts (done)
4. Plans + assignment + notifications
5. Progress reports
6. Dashboard
7. React screens per role
8. Postman collection + final docs
