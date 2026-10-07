from psycopg.errors import UniqueViolation

from app.core import security
from app.core.errors import AppError
from app.repositories import user_repository


def onboard(conn, name: str, email: str):
    """Creates a trainee with a random one-time password. Returns (trainee, password)."""
    temp_password = security.generate_temp_password()
    try:
        trainee = user_repository.create_trainee(conn, name, email, security.hash_password(temp_password))
    except UniqueViolation:
        # The database's unique index is the real guard; this just words it nicely.
        raise AppError(409, "A user with this email already exists")
    return trainee, temp_password


def list_trainees(conn, limit: int, offset: int, not_in_cohort=None, not_assigned_plan=None, q=None):
    return user_repository.list_trainees(conn, limit, offset, not_in_cohort, not_assigned_plan, q)
