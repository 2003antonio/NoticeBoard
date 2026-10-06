from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator


class CohortCreate(BaseModel):
    name: str = Field(max_length=100)

    @field_validator("name")
    @classmethod
    def clean_name(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Name is required")
        return v


class CohortOut(BaseModel):
    id: UUID
    name: str
    created_at: datetime
    member_count: int = 0


class CohortList(BaseModel):
    items: list[CohortOut]
    total: int
    limit: int
    offset: int


class AddMember(BaseModel):
    trainee_id: UUID


class MemberOut(BaseModel):
    id: UUID
    name: str
    email: str
    active: bool
    added_at: datetime


class MemberList(BaseModel):
    items: list[MemberOut]
