import secrets
from datetime import datetime, timedelta, timezone

import bcrypt
import jwt

from app.config import get_settings
from app.core.errors import AppError

BCRYPT_ROUNDS = 10
MAX_PASSWORD_BYTES = 72  # bcrypt ignores everything after this


def hash_password(plain: str) -> str:
    return bcrypt.hashpw(plain.encode(), bcrypt.gensalt(BCRYPT_ROUNDS)).decode()


def verify_password(plain: str, hashed: str) -> bool:
    raw = plain.encode()
    if len(raw) > MAX_PASSWORD_BYTES:
        return False
    return bcrypt.checkpw(raw, hashed.encode())


# Used when the email is unknown, so "no such user" takes as long as "wrong password".
DUMMY_HASH = hash_password("not-a-real-password")


def validate_new_password(pw: str) -> str | None:
    """Returns an error message, or None if the password is acceptable."""
    if len(pw) < 8:
        return "Password must be at least 8 characters"
    if len(pw.encode()) > MAX_PASSWORD_BYTES:
        return "Password must be at most 72 bytes"
    return None


def generate_temp_password() -> str:
    """Random one-time password for newly created accounts (12 characters)."""
    return secrets.token_urlsafe(9)


def create_access_token(user_id: str) -> str:
    settings = get_settings()
    now = datetime.now(timezone.utc)
    payload = {
        "sub": str(user_id),
        "iat": now,
        "exp": now + timedelta(minutes=settings.jwt_expires_minutes),
    }
    return jwt.encode(payload, settings.jwt_secret, algorithm="HS256")


def decode_access_token(token: str) -> str:
    """Returns the user id inside a valid token, or raises a 401."""
    try:
        claims = jwt.decode(token, get_settings().jwt_secret, algorithms=["HS256"])
        return claims["sub"]
    except (jwt.PyJWTError, KeyError):
        raise AppError(401, "Invalid or expired token")
