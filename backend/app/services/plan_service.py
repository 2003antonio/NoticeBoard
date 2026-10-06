from psycopg.errors import UniqueViolation

from app.core.errors import AppError
from app.repositories import cohort_repository, plan_repository, user_repository


def create_plan(conn, title: str, description, due_date, created_by):
    return plan_repository.create(conn, title, description, due_date, created_by)


def list_plans(conn, limit: int, offset: int):
    return plan_repository.list_plans(conn, limit, offset)


def _require_plan(conn, plan_id):
    plan = plan_repository.get(conn, plan_id)
    if not plan:
        raise AppError(404, "Plan not found")
    return plan


def get_plan(conn, plan_id):
    return _require_plan(conn, plan_id)


def assign(conn, plan_id, cohort_id, trainee_id):
    """Assign a plan to a cohort or a single trainee and notify the recipients.

    The assignment row and its notifications are written in the request's single
    transaction, so if anything fails neither the assignment nor any
    notification survives (all-or-nothing). The schema's exactly-one-target rule
    is enforced by the request schema before we get here.
    """
    _require_plan(conn, plan_id)
    if cohort_id is not None:
        return _assign_to_cohort(conn, plan_id, cohort_id)
    return _assign_to_trainee(conn, plan_id, trainee_id)


def _assign_to_cohort(conn, plan_id, cohort_id):
    if not cohort_repository.get(conn, cohort_id):
        raise AppError(404, "Cohort not found")

    # Lock the cohort so this assignment and any concurrent add-member take turns
    # (see cohort_repository.lock); then the fan-out below sees a stable member set.
    cohort_repository.lock(conn, cohort_id)

    try:
        assignment = plan_repository.assign_cohort(conn, plan_id, cohort_id)
    except UniqueViolation:
        raise AppError(409, "This plan is already assigned to that cohort")

    notified = plan_repository.notify_cohort(conn, plan_id, cohort_id)
    return {**assignment, "notified": notified}


def _assign_to_trainee(conn, plan_id, trainee_id):
    trainee = user_repository.get_trainee(conn, trainee_id)
    if not trainee:
        # Not a trainee (or no such user). We don't distinguish, to avoid probing.
        raise AppError(404, "Trainee not found")
    if not trainee["active"]:
        raise AppError(400, "Trainee is deactivated")

    try:
        assignment = plan_repository.assign_trainee(conn, plan_id, trainee_id)
    except UniqueViolation:
        raise AppError(409, "This plan is already assigned to that trainee")

    notified = plan_repository.notify_trainee(conn, plan_id, trainee_id)
    return {**assignment, "notified": notified}


def my_plans(conn, trainee_id):
    return plan_repository.my_plans(conn, trainee_id)
