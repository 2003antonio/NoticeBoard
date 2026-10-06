"""Business rules for the manager dashboard.

The classification rules themselves live in dashboard_repository._PAIRS_CTE; this
layer owns the one tunable number and turns raw counts into the response shape.
"""

from app.repositories import dashboard_repository

# The check-in window, defined in exactly ONE place. A pair with no activity for
# longer than this (and not done) is "missing". Passed into every dashboard query
# as a bound parameter, so the SQL never hard-codes it.
CHECKIN_DAYS = 7


def _completion_percent(done: int, total: int) -> float:
    # Share of pairs that are done, to one decimal; 0.0 when there are no pairs.
    return round(done / total * 100, 1) if total else 0.0


def summary(conn):
    row = dict(dashboard_repository.summary(conn, CHECKIN_DAYS))
    row["completion_percent"] = _completion_percent(row["done"], row["total_pairs"])
    return row


def cohort_rows(conn, limit: int, offset: int):
    items, total = dashboard_repository.cohort_rows(conn, CHECKIN_DAYS, limit, offset)
    items = [
        {**dict(r), "completion_percent": _completion_percent(r["done"], r["total_pairs"])}
        for r in items
    ]
    return items, total


def trainee_pairs(conn, limit, offset, **filters):
    return dashboard_repository.trainee_pairs(conn, CHECKIN_DAYS, limit, offset, **filters)
