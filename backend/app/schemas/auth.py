from uuid import UUID

from pydantic import BaseModel, Field


class LoginRequest(BaseModel):
    email: str = Field(max_length=254)
    password: str = Field(max_length=128)


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(max_length=128)
    new_password: str = Field(max_length=128)


class UserOut(BaseModel):
    """What the client may see about a user. The password hash is not in here,
    so it can never be returned by accident."""

    id: UUID
    name: str
    email: str
    role: str
    must_change_password: bool


class LoginResponse(BaseModel):
    token: str
    user: UserOut


class MeResponse(BaseModel):
    user: UserOut


class MessageResponse(BaseModel):
    message: str
