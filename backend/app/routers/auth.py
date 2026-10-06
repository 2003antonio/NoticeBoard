"""Controllers: read the request, call the service, shape the response."""

from fastapi import APIRouter, Depends, Request

from app.core import security
from app.core.errors import AppError
from app.core.rate_limit import login_limiter
from app.database import get_db
from app.dependencies import get_current_user_allow_password_change
from app.schemas.auth import (
    ChangePasswordRequest,
    LoginRequest,
    LoginResponse,
    MeResponse,
    MessageResponse,
)
from app.services import auth_service

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=LoginResponse)
def login(body: LoginRequest, request: Request, conn=Depends(get_db)):
    # Behind a proxy/load balancer this would be the forwarded client address.
    client_ip = request.client.host if request.client else "unknown"
    login_limiter.check(client_ip)
    try:
        user = auth_service.authenticate(conn, body.email, body.password)
    except AppError:
        login_limiter.record_failure(client_ip)
        raise
    return {"token": security.create_access_token(user["id"]), "user": user}


@router.get("/me", response_model=MeResponse)
def me(user=Depends(get_current_user_allow_password_change)):
    return {"user": user}


@router.post("/change-password", response_model=MessageResponse)
def change_password(
    body: ChangePasswordRequest,
    user=Depends(get_current_user_allow_password_change),
    conn=Depends(get_db),
):
    auth_service.change_password(conn, user["id"], body.current_password, body.new_password)
    return {"message": "Password changed"}
