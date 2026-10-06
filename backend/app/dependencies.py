from uuid import UUID

from fastapi import Depends
from fastapi.security import HTTPBearer

from app.core.errors import AppError
from app.core.security import decode_access_token
from app.database import get_db
from app.repositories import user_repository

_bearer = HTTPBearer(auto_error=False)


def _authenticate(allow_password_change: bool):
    def dependency(creds=Depends(_bearer), conn=Depends(get_db)) -> dict:
        if creds is None:
            raise AppError(401, "Login required")

        user_id = decode_access_token(creds.credentials)
        try:
            UUID(user_id)
        except ValueError:
            raise AppError(401, "Invalid or expired token")

        # Loaded fresh each time, so deactivating a user or changing a role
        # takes effect immediately, even for tokens already issued.
        user = user_repository.get_by_id(conn, user_id)
        if not user or not user["active"]:
            raise AppError(401, "Invalid or expired token")

        if user["must_change_password"] and not allow_password_change:
            raise AppError(403, "You must change your password first", code="PASSWORD_CHANGE_REQUIRED")
        return user

    return dependency


# Normal routes: logged in AND not stuck on a forced password change.
get_current_user = _authenticate(allow_password_change=False)
# Only for /auth/me and /auth/change-password.
get_current_user_allow_password_change = _authenticate(allow_password_change=True)


def require_role(*roles: str):
    """Usage: user = Depends(require_role("hr", "manager"))"""

    def dependency(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise AppError(403, "You do not have permission to do that")
        return user

    return dependency
