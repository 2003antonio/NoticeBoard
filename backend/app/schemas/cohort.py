from datetime import date, datetime
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


class CohortDetailOut(BaseModel):
    """One cohort, for its detail page. active_member_count excludes deactivated
    users (it's how many people actually get a plan assigned to the cohort)."""

    id: UUID
    name: str
    created_at: datetime
    active_member_count: int


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


class CohortPlanOut(BaseModel):
    id: UUID
    title: str
    due_date: date | None = None
    assigned_at: datetime
    # How many active members currently get this plan ("N members get this").
    active_member_count: int


class CohortPlanList(BaseModel):
    items: list[CohortPlanOut]
    total: int
    limit: int
    offset: int
