from psycopg.errors import UniqueViolation

from app.core.errors import AppError
from app.repositories import plan_repository, report_repository


def _require_my_plan(conn, trainee_id, plan_id):
    # One answer for "no such plan" and "not your plan", so a trainee cannot probe
    # which plans exist or who else has them.
    if not report_repository.trainee_receives_plan(conn, trainee_id, plan_id):
        raise AppError(404, "Plan not found")


def submit(conn, trainee_id, plan_id, status: str, notes):
    _require_my_plan(conn, trainee_id, plan_id)

    # "Done" is final: once reported done, nothing further is accepted.
    if report_repository.latest_status(conn, trainee_id, plan_id) == "done":
        raise AppError(409, "This plan is already marked done")

    try:
        return report_repository.create(conn, trainee_id, plan_id, status, notes)
    except UniqueViolation:
        # Two "done" submissions at the same instant: the database lets only one win.
        raise AppError(409, "This plan is already marked done")


def list_mine(conn, trainee_id, plan_id, limit: int, offset: int):
    _require_my_plan(conn, trainee_id, plan_id)
    return report_repository.list_for_trainee_plan(conn, trainee_id, plan_id, limit, offset)


def list_for_plan(conn, plan_id, trainee_id, limit: int, offset: int):
    if not plan_repository.get(conn, plan_id):
        raise AppError(404, "Plan not found")
    return report_repository.list_for_plan(conn, plan_id, trainee_id, limit, offset)
