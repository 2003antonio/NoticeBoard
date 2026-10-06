import re
from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_EMAIL = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class TraineeCreate(BaseModel):
    name: str = Field(max_length=100)
    email: str = Field(max_length=254)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v

    @field_validator("email")
    @classmethod
    def clean_email(cls, v: str) -> str:
        v = v.strip().lower()  # stored lowercase so duplicates can't hide behind capitals
        if not _EMAIL.match(v):
            raise ValueError("Enter a valid email address")
        return v


class TraineeOut(BaseModel):
    id: UUID
    name: str
    email: str
    active: bool
    created_at: datetime


class TraineeCreated(BaseModel):
    trainee: TraineeOut
    # Shown ONCE, here. Only the hash is stored, so it can never be looked up again.
    temporary_password: str


class TraineeList(BaseModel):
    items: list[TraineeOut]
    total: int
    limit: int
    offset: int
