-- DEV ONLY demo data. Never run against a real database.
-- Passwords are hashed with bcrypt (crypt + gen_salt('bf')) before storing.

INSERT INTO users (name, email, password_hash, role) VALUES
  ('Demo Trainee', 'user@noticeboard.test',          crypt('user123',          gen_salt('bf', 10)), 'trainee'),
  ('Demo Manager', 'admin@noticeboard.test',         crypt('admin123',         gen_salt('bf', 10)), 'manager'),
  ('Demo HR',      'humanresource@noticeboard.test', crypt('humanresource123', gen_salt('bf', 10)), 'hr'),
  ('Maria Lopez',  'maria@noticeboard.test',         crypt('user123',          gen_salt('bf', 10)), 'trainee'),
  ('Carlos Diaz',  'carlos@noticeboard.test',        crypt('user123',          gen_salt('bf', 10)), 'trainee');

INSERT INTO cohorts (name, created_by)
  SELECT 'Cohort A', id FROM users WHERE email = 'admin@noticeboard.test';

INSERT INTO cohort_members (cohort_id, trainee_id)
  SELECT c.id, u.id FROM cohorts c, users u
  WHERE c.name = 'Cohort A' AND u.role = 'trainee';

INSERT INTO plans (title, description, due_date, created_by)
  SELECT 'Week 1: Onboarding', 'Complete setup and intro modules', CURRENT_DATE + 7, id
  FROM users WHERE email = 'admin@noticeboard.test';

INSERT INTO plan_assignments (plan_id, cohort_id)
  SELECT p.id, c.id FROM plans p, cohorts c
  WHERE p.title = 'Week 1: Onboarding' AND c.name = 'Cohort A';

-- Mirrors the real fan-out: message text and plan_id match what the app writes.
INSERT INTO notifications (user_id, message, plan_id)
  SELECT u.id,
         'New plan assigned: ' || p.title || ' (due ' || to_char(p.due_date, 'YYYY-MM-DD') || ')',
         p.id
  FROM users u, plans p
  WHERE u.role = 'trainee' AND p.title = 'Week 1: Onboarding';

INSERT INTO progress_reports (assignment_id, trainee_id, status, notes)
  SELECT a.id, u.id, 'on_track', 'Finished setup, starting intro modules'
  FROM plan_assignments a, users u WHERE u.email = 'user@noticeboard.test';
