from psycopg.errors import UniqueViolation

from app.core.errors import AppError
from app.repositories import cohort_repository, user_repository


def create_cohort(conn, name: str, created_by):
    try:
        return cohort_repository.create(conn, name, created_by)
    except UniqueViolation:
        raise AppError(409, "A cohort with this name already exists")


def list_cohorts(conn, limit: int, offset: int):
    return cohort_repository.list_with_counts(conn, limit, offset)


def _require_cohort(conn, cohort_id):
    cohort = cohort_repository.get(conn, cohort_id)
    if not cohort:
        raise AppError(404, "Cohort not found")
    return cohort


def add_member(conn, cohort_id, trainee_id) -> None:
    _require_cohort(conn, cohort_id)

    trainee = user_repository.get_trainee(conn, trainee_id)
    if not trainee:
        raise AppError(404, "Trainee not found")
    if not trainee["active"]:
        raise AppError(400, "Trainee is deactivated")

    # Serialize with any concurrent plan assignment to this same cohort (see
    # cohort_repository.lock) so a new member is never skipped by a fan-out.
    cohort_repository.lock(conn, cohort_id)

    try:
        cohort_repository.add_member(conn, cohort_id, trainee_id)
    except UniqueViolation:
        raise AppError(409, "Trainee is already in this cohort")

    # Late-joiner rule: catch the new member up on plans already assigned to this
    # cohort. Same transaction as the membership insert, so it is all-or-nothing.
    cohort_repository.notify_existing_plans(conn, cohort_id, trainee_id)


def list_members(conn, cohort_id):
    _require_cohort(conn, cohort_id)
    return cohort_repository.list_members(conn, cohort_id)
