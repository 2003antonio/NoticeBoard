# NoticeBoardTracker

A full-stack platform for an EdTech organization that replaces scattered 1:1 messages and Excel sheets with automated notifications, progress reporting, and a manager dashboard.

## Live demo

http://antoniomartinez-noticeboard.s3-website-us-east-1.amazonaws.com

Use the demo logins listed below (shared demo data only). Hosted on AWS: S3 (React site), API Gateway + Lambda (FastAPI), and Neon Postgres.

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
- Hosting: AWS S3, API Gateway, Lambda; Neon Postgres
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

## Run the frontend locally (Windows PowerShell)

Requirements: Node.js 20+ (the project was built on Node 24). Start the backend first (above).

```powershell
cd frontend
npm install
Copy-Item .env.example .env   # VITE_API_URL defaults to http://localhost:8000
npm run dev                   # opens http://localhost:5173
```

Other commands: `npm test` (Vitest unit tests), `npm run build` (static files into `frontend\dist`), `npm run preview` (serve the built files).

## Try the API in Postman

1. In Postman, import `postmanscript/NoticeBoardTracker.postman_collection.json` and `postmanscript/NoticeBoardTracker.local.postman_environment.json`, then pick the environment (top right).
2. Start the backend, then run the collection with the Collection Runner. Run it once in order (folders 00 to 06): it logs in, onboards a trainee, builds a cohort and plan, walks the trainee's first login and reports, checks the dashboard, and ends with security checks (expect 401, 403, 400 and 409 where noted).
3. For a deployed copy, import `NoticeBoardTracker.aws.postman_environment.json` and set `baseUrl` to your API address.
4. Needs the demo accounts, so load `seed.sql` first. 49 requests, 56 checks.

## Demo logins (demo seed data only)

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
- [x] Progress reports
- [x] Manager dashboard
- [x] React frontend (editorial design, light and dark)
- [x] Smart pickers and clickable rows (cohort plans, only-available choices)
- [x] Postman collection
- [x] Deployed to AWS (S3 + API Gateway + Lambda)
- [ ] Architecture.md final
