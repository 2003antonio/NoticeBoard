-- NoticeBoardTracker schema (PostgreSQL 13+)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

DROP TABLE IF EXISTS progress_reports, notifications, plan_assignments,
  plans, cohort_members, cohorts, users CASCADE;
DROP TYPE IF EXISTS report_status, user_role;

CREATE TYPE user_role AS ENUM ('hr', 'manager', 'trainee');
CREATE TYPE report_status AS ENUM ('on_track', 'blocked', 'done');

-- Random UUIDs as ids: not guessable, not sequential.
CREATE TABLE users (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  email                text NOT NULL,
  password_hash        text NOT NULL,          -- bcrypt hash, never plain text
  role                 user_role NOT NULL,
  active               boolean NOT NULL DEFAULT true,
  must_change_password boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive uniqueness: Ana@x.com and ana@x.com are the same person.
CREATE UNIQUE INDEX users_email_unique ON users (lower(email));

CREATE TABLE cohorts (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);
-- Case-insensitive: "Cohort A" and "cohort a" are the same cohort.
CREATE UNIQUE INDEX cohorts_name_unique ON cohorts (lower(name));

CREATE TABLE cohort_members (
  cohort_id  uuid NOT NULL REFERENCES cohorts(id) ON DELETE CASCADE,
  trainee_id uuid NOT NULL REFERENCES users(id),
  added_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (cohort_id, trainee_id)          -- no duplicate membership
);

CREATE TABLE plans (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title       text NOT NULL,
  description text,
  due_date    date,
  created_by  uuid NOT NULL REFERENCES users(id),
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- A plan goes to a cohort OR to one trainee, never both, never neither.
CREATE TABLE plan_assignments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id     uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  cohort_id   uuid REFERENCES cohorts(id),
  trainee_id  uuid REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  CHECK ((cohort_id IS NULL) <> (trainee_id IS NULL))
);
CREATE UNIQUE INDEX assign_plan_cohort_unique  ON plan_assignments (plan_id, cohort_id)  WHERE cohort_id  IS NOT NULL;
CREATE UNIQUE INDEX assign_plan_trainee_unique ON plan_assignments (plan_id, trainee_id) WHERE trainee_id IS NOT NULL;

CREATE TABLE notifications (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES users(id),
  message    text NOT NULL,
  is_read    boolean NOT NULL DEFAULT false,
  -- Optional link to the plan this notification is about, so the frontend can
  -- open it. ON DELETE CASCADE: removing a plan clears its notifications too.
  plan_id    uuid REFERENCES plans(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX notifications_user_idx ON notifications (user_id, is_read);
-- The feed reads one user's notifications newest-first; this index serves it.
CREATE INDEX notifications_user_created_idx ON notifications (user_id, created_at DESC);

-- A report is about a trainee's progress on a PLAN, not on one assignment, so a
-- plan that reaches a trainee both directly and through a cohort still has a
-- single history. Many reports per trainee+plan are allowed: each is an update.
CREATE TABLE progress_reports (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  plan_id      uuid NOT NULL REFERENCES plans(id) ON DELETE CASCADE,
  trainee_id   uuid NOT NULL REFERENCES users(id),
  status       report_status NOT NULL,
  notes        text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  -- A blocked trainee must say what is blocking them.
  CONSTRAINT blocked_needs_notes CHECK (status <> 'blocked' OR length(btrim(coalesce(notes, ''))) > 0)
);
-- "Latest report per trainee+plan" is the hot query (dashboard, /my/plans).
CREATE INDEX reports_trainee_plan_idx ON progress_reports (trainee_id, plan_id, submitted_at DESC);
CREATE INDEX reports_plan_idx ON progress_reports (plan_id, submitted_at DESC);
-- "Done" is final: at most one done report per trainee+plan, even if two
-- submissions arrive at the same moment.
CREATE UNIQUE INDEX reports_one_done_unique ON progress_reports (trainee_id, plan_id) WHERE status = 'done';
