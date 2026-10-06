"""The ONLY place that writes SQL for the manager dashboard.

Every dashboard number comes from one shared definition of a "recipient pair"
(_PAIRS_CTE), so the summary, the cohort rows and the drill-down can never
disagree: they all read the same classified rows. Nothing here loops in Python.
"""

# A recipient pair is one (active trainee, plan) they receive, directly or
# through any cohort, counted once. This CTE classifies every pair. It takes
# exactly ONE bind parameter: the check-in window in days (CHECKIN_DAYS). Any
# query that includes it must therefore pass that parameter first.
_PAIRS_CTE = """
WITH routes AS (
  -- Every way an ACTIVE trainee receives a plan, plus when their clock starts.
  -- Direct assignment: the clock starts at assignment time.
  SELECT a.trainee_id AS trainee_id, a.plan_id AS plan_id,
         a.assigned_at AS start_at, 'direct' AS source, 0 AS prio, '' AS sort_name
  FROM plan_assignments a
  JOIN users u ON u.id = a.trainee_id AND u.active
  WHERE a.trainee_id IS NOT NULL
  UNION ALL
  -- Cohort assignment: a late joiner is not "late" for time before they joined,
  -- so their clock starts at the later of (assigned, joined).
  SELECT m.trainee_id, a.plan_id,
         GREATEST(a.assigned_at, m.added_at) AS start_at,
         c.name AS source, 1 AS prio, lower(c.name) AS sort_name
  FROM plan_assignments a
  JOIN cohorts c ON c.id = a.cohort_id
  JOIN cohort_members m ON m.cohort_id = c.id
  JOIN users u ON u.id = m.trainee_id AND u.active
  WHERE a.cohort_id IS NOT NULL
),
pairs_raw AS (
  -- Collapse the routes to one row per (trainee, plan). DISTINCT ON keeps the
  -- winning source (direct first, else the alphabetically-first cohort), while
  -- the window min() takes the earliest clock start across ALL of the routes.
  SELECT DISTINCT ON (trainee_id, plan_id)
         trainee_id, plan_id, source,
         min(start_at) OVER (PARTITION BY trainee_id, plan_id) AS baseline_time
  FROM routes
  ORDER BY trainee_id, plan_id, prio, sort_name
),
classified AS (
  SELECT pr.trainee_id, pr.plan_id, pr.source, pr.baseline_time,
         p.title AS plan_title, p.due_date,
         -- status is an enum; cast to text so the "no_report" sentinel fits.
         COALESCE(lr.status::text, 'no_report') AS latest_status,
         lr.submitted_at AS last_report_at,
         (COALESCE(lr.status::text, 'no_report') = 'done') AS is_done,
         -- Overdue: the due date has passed and the pair is not done.
         (p.due_date IS NOT NULL AND p.due_date < CURRENT_DATE
          AND COALESCE(lr.status::text, 'no_report') <> 'done') AS is_overdue,
         -- Missing: not done, and the last activity is older than the check-in
         -- window. Last activity is the latest report, or the baseline clock
         -- start if they have never reported.
         (COALESCE(lr.status::text, 'no_report') <> 'done'
          AND COALESCE(lr.submitted_at, pr.baseline_time) < now() - make_interval(days => %s)
         ) AS is_missing
  FROM pairs_raw pr
  JOIN plans p ON p.id = pr.plan_id
  -- Latest report for this trainee+plan: one indexed lookup each
  -- (reports_trainee_plan_idx = trainee_id, plan_id, submitted_at DESC).
  LEFT JOIN LATERAL (
    SELECT status, submitted_at FROM progress_reports r
    WHERE r.trainee_id = pr.trainee_id AND r.plan_id = pr.plan_id
    ORDER BY r.submitted_at DESC, r.id DESC LIMIT 1
  ) lr ON true
),
pairs AS (
  -- A done pair is never overdue/missing/attention (the flags above already
  -- excluded done); needs_attention rolls up the three concern signals.
  SELECT *,
         (latest_status = 'blocked' OR is_overdue OR is_missing) AS needs_attention
  FROM classified
)
"""


def summary(conn, checkin_days: int):
    # Counts over every pair, plus three independent totals that do not depend on
    # pairs (active trainees, cohorts, plans) as scalar subqueries in one round trip.
    return conn.execute(
        _PAIRS_CTE
        + """
        SELECT
          count(*) AS total_pairs,
          count(*) FILTER (WHERE is_done) AS done,
          count(*) FILTER (WHERE latest_status = 'on_track') AS on_track,
          count(*) FILTER (WHERE latest_status = 'blocked') AS blocked,
          count(*) FILTER (WHERE latest_status = 'no_report') AS no_report,
          count(*) FILTER (WHERE is_overdue) AS overdue,
          count(*) FILTER (WHERE is_missing) AS missing,
          count(*) FILTER (WHERE needs_attention) AS needs_attention,
          (SELECT count(*) FROM users WHERE role = 'trainee' AND active) AS active_trainees,
          (SELECT count(*) FROM cohorts) AS cohorts,
          (SELECT count(*) FROM plans) AS plans
        FROM pairs
        """,
        (checkin_days,),
    ).fetchone()


def cohort_rows(conn, checkin_days: int, limit: int, offset: int):
    items = conn.execute(
        _PAIRS_CTE
        + """,
        cohort_pairs AS (
          -- Attribute each classified pair to every cohort it is reached through
          -- (a trainee in two cohorts is counted in both rows -- intended).
          SELECT c.id AS cohort_id, pr.is_done, pr.is_overdue, pr.is_missing,
                 pr.needs_attention, pr.latest_status
          FROM cohorts c
          JOIN plan_assignments a ON a.cohort_id = c.id
          JOIN cohort_members m ON m.cohort_id = c.id
          JOIN users u ON u.id = m.trainee_id AND u.active
          JOIN pairs pr ON pr.trainee_id = m.trainee_id AND pr.plan_id = a.plan_id
        ),
        agg AS (
          SELECT cohort_id,
                 count(*) AS total_pairs,
                 count(*) FILTER (WHERE is_done) AS done,
                 count(*) FILTER (WHERE latest_status = 'blocked') AS blocked,
                 count(*) FILTER (WHERE is_overdue) AS overdue,
                 count(*) FILTER (WHERE is_missing) AS missing,
                 count(*) FILTER (WHERE needs_attention) AS needs_attention
          FROM cohort_pairs GROUP BY cohort_id
        ),
        members AS (
          SELECT m.cohort_id, count(*) AS member_count
          FROM cohort_members m JOIN users u ON u.id = m.trainee_id AND u.active
          GROUP BY m.cohort_id
        ),
        plancounts AS (
          SELECT cohort_id, count(*) AS plan_count
          FROM plan_assignments WHERE cohort_id IS NOT NULL GROUP BY cohort_id
        )
        SELECT c.id AS cohort_id, c.name,
               COALESCE(members.member_count, 0) AS member_count,
               COALESCE(plancounts.plan_count, 0) AS plan_count,
               COALESCE(agg.total_pairs, 0) AS total_pairs,
               COALESCE(agg.done, 0) AS done,
               COALESCE(agg.blocked, 0) AS blocked,
               COALESCE(agg.overdue, 0) AS overdue,
               COALESCE(agg.missing, 0) AS missing,
               COALESCE(agg.needs_attention, 0) AS needs_attention
        FROM cohorts c
        LEFT JOIN agg ON agg.cohort_id = c.id
        LEFT JOIN members ON members.cohort_id = c.id
        LEFT JOIN plancounts ON plancounts.cohort_id = c.id
        ORDER BY COALESCE(agg.needs_attention, 0) DESC, lower(c.name), c.id
        LIMIT %s OFFSET %s
        """,
        (checkin_days, limit, offset),
    ).fetchall()
    total = conn.execute("SELECT count(*) AS n FROM cohorts").fetchone()["n"]
    return items, total


# The drill-down filters. Each is a fixed SQL fragment chosen by a flag; every
# value is still bound as a %s parameter, never interpolated.
def _trainee_filters(cohort_id, plan_id, trainee_id, attention_only, status):
    clauses, params = [], []
    if cohort_id is not None:
        # "Reached through this cohort": the plan is assigned to it and the
        # trainee is an active member of it.
        clauses.append(
            """EXISTS (SELECT 1 FROM plan_assignments a
                       JOIN cohort_members m ON m.cohort_id = a.cohort_id
                       JOIN users cu ON cu.id = m.trainee_id AND cu.active
                       WHERE a.cohort_id = %s AND a.plan_id = pairs.plan_id
                         AND m.trainee_id = pairs.trainee_id)"""
        )
        params.append(cohort_id)
    if plan_id is not None:
        clauses.append("pairs.plan_id = %s")
        params.append(plan_id)
    if trainee_id is not None:
        clauses.append("pairs.trainee_id = %s")
        params.append(trainee_id)
    if attention_only:
        clauses.append("pairs.needs_attention")
    if status is not None:
        clauses.append("pairs.latest_status = %s")
        params.append(status)
    where = (" WHERE " + " AND ".join(clauses)) if clauses else ""
    return where, params


def trainee_pairs(conn, checkin_days, limit, offset, *, cohort_id=None, plan_id=None,
                  trainee_id=None, attention_only=False, status=None):
    where, fparams = _trainee_filters(cohort_id, plan_id, trainee_id, attention_only, status)
    items = conn.execute(
        _PAIRS_CTE
        + f"""
        SELECT pairs.trainee_id, u.name AS trainee_name, u.email AS trainee_email,
               pairs.plan_id, pairs.plan_title, pairs.due_date,
               pairs.latest_status, pairs.last_report_at,
               pairs.is_done, pairs.is_overdue, pairs.is_missing,
               pairs.needs_attention, pairs.source
        FROM pairs JOIN users u ON u.id = pairs.trainee_id
        {where}
        -- Worst first: attention, then overdue, then the stalest activity, then name.
        ORDER BY pairs.needs_attention DESC, pairs.is_overdue DESC,
                 COALESCE(pairs.last_report_at, pairs.baseline_time) ASC,
                 lower(u.name), pairs.trainee_id, pairs.plan_id
        LIMIT %s OFFSET %s
        """,
        (checkin_days, *fparams, limit, offset),
    ).fetchall()
    total = conn.execute(
        _PAIRS_CTE + f" SELECT count(*) AS n FROM pairs{where}",
        (checkin_days, *fparams),
    ).fetchone()["n"]
    return items, total
