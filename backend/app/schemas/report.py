from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, ValidationInfo, field_validator

Status = Literal["on_track", "blocked", "done"]


class ReportCreate(BaseModel):
    status: Status
    # validate_default makes the check below run even when "notes" is left out
    # entirely, which is exactly the case "blocked" must catch.
    notes: str | None = Field(default=None, max_length=2000, validate_default=True)

    @field_validator("notes")
    @classmethod
    def clean_notes(cls, v: str | None, info: ValidationInfo) -> str | None:
        v = v.strip() if v is not None else None
        v = v or None  # blank notes count as no notes
        # A blocked trainee has to say what is blocking them. (The database has the
        # same rule as a CHECK constraint, as a backstop.)
        if info.data.get("status") == "blocked" and v is None:
            raise ValueError("Say what is blocking you")
        return v


class ReportOut(BaseModel):
    id: UUID
    plan_id: UUID
    status: Status
    notes: str | None = None
    submitted_at: datetime


class ReportList(BaseModel):
    items: list[ReportOut]
    total: int
    limit: int
    offset: int


class PlanReportOut(BaseModel):
    """What a manager sees: the same report plus who wrote it."""

    id: UUID
    trainee_id: UUID
    trainee_name: str
    trainee_email: str
    status: Status
    notes: str | None = None
    submitted_at: datetime


class PlanReportList(BaseModel):
    items: list[PlanReportOut]
    total: int
    limit: int
    offset: int
