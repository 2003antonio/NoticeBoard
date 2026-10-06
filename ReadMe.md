# NoticeBoardTracker

A full-stack platform for an EdTech organization that replaces scattered 1:1 messages and Excel sheets with automated notifications, progress reporting, and a manager dashboard.

## Who uses it

| Role | What they do |
|---|---|
| HR / People | Onboard new trainees (no duplicates) |
| Training Manager | Create plans, assign them to cohorts or single trainees, watch the dashboard |
| Trainee | See assigned plans, read notifications, submit progress reports |

## Problems it solves

- Scattered 1:1 channels -> in-app notifications
- Manual Excel tracking -> database + forms
- Missing / duplicate trainees -> unique email, enforced by the database
- Delayed updates, no oversight -> progress reports + dashboard

## Stack

- Backend: Python, FastAPI, PostgreSQL (psycopg)
- Frontend: React
- Auth: JWT, bcrypt password hashing, role checks
- Notifications: in-app only
- Tests: pytest

## Run the backend locally

Requirements: Python 3.11+, PostgreSQL 16+.

1. Create the database and load `backend/db/schema.sql`, then `backend/db/seed.sql` (demo data, dev only).
2. In `backend/`: `python -m venv .venv`, activate it, then `pip install -r requirements-dev.txt`.
3. Copy `.env.example` to `.env`, fill in `DATABASE_URL` and `JWT_SECRET`.
4. `uvicorn app.main:app --reload` then open http://localhost:8000/health (interactive docs at /docs).
5. `pytest` runs the tests against the database in `DATABASE_URL`.

## Demo logins (dev seed data only)

| Role | Email | Password |
|---|---|---|
| Trainee | user@noticeboard.test | user123 |
| Manager | admin@noticeboard.test | admin123 |
| HR | humanresource@noticeboard.test | humanresource123 |

## Status

- [x] Database schema + seed data
- [x] Login, roles, forced password change
- [x] Trainee onboarding (HR)
- [x] Cohorts and members
- [x] Plans + assignments
- [x] Notifications (feed, unread count, late-joiner catch-up)
- [ ] Progress reports
- [ ] Manager dashboard
- [ ] React frontend
- [ ] Postman collection
- [ ] Architecture.md final
