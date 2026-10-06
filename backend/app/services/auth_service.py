"""Login and password rules. No HTTP and no SQL in here."""

from app.core import security
from app.core.errors import AppError
from app.repositories import user_repository


def authenticate(conn, email: str, password: str) -> dict:
    user = user_repository.get_by_email(conn, email.strip().lower())

    # Same work and same message whether the email exists or not.
    hash_to_check = user["password_hash"] if user else security.DUMMY_HASH
    password_ok = security.verify_password(password, hash_to_check)

    if not user or not user["active"] or not password_ok:
        raise AppError(401, "Invalid email or password")
    return user


def change_password(conn, user_id, current_password: str, new_password: str) -> None:
    problem = security.validate_new_password(new_password)
    if problem:
        raise AppError(400, problem)
    if new_password == current_password:
        raise AppError(400, "New password must be different from the current one")

    stored = user_repository.get_password_hash(conn, user_id)
    if not security.verify_password(current_password, stored):
        raise AppError(401, "Current password is incorrect")

    user_repository.update_password(conn, user_id, security.hash_password(new_password))
