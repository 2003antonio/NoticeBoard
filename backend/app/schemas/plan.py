from datetime import date, datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator, model_validator


class PlanCreate(BaseModel):
    title: str = Field(max_length=200)
    description: str | None = Field(default=None, max_length=2000)
    due_date: date | None = None

    @field_validator("title")
    @classmethod
    def clean_title(cls, v: str) -> str:
        v = v.strip()
        if not v:
            raise ValueError("Title is required")
        return v

    @field_validator("description")
    @classmethod
    def clean_description(cls, v: str | None) -> str | None:
        # Treat a blank or whitespace-only description as "no description".
        if v is None:
            return None
        v = v.strip()
        return v or None

    @field_validator("due_date")
    @classmethod
    def not_in_the_past(cls, v: date | None) -> date | None:
        if v is not None and v < date.today():
            raise ValueError("Due date cannot be in the past")
        return v


class PlanOut(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    due_date: date | None = None
    created_at: datetime


class PlanList(BaseModel):
    items: list[PlanOut]
    total: int
    limit: int
    offset: int


class AssignmentCreate(BaseModel):
    cohort_id: UUID | None = None
    trainee_id: UUID | None = None

    @model_validator(mode="after")
    def exactly_one_target(self):
        # A plan goes to a cohort OR a single trainee, never both, never neither.
        # (cohort is None) == (trainee is None) is true when both are set or both
        # are empty -- either way the request is invalid.
        if (self.cohort_id is None) == (self.trainee_id is None):
            raise ValueError("Provide exactly one of cohort_id or trainee_id")
        return self


class AssignmentOut(BaseModel):
    id: UUID
    plan_id: UUID
    cohort_id: UUID | None = None
    trainee_id: UUID | None = None
    assigned_at: datetime
    # How many trainees were notified by this assignment (active members, or 1
    # for a solo target, or 0 for an empty cohort).
    notified: int


class MyPlanOut(BaseModel):
    id: UUID
    title: str
    description: str | None = None
    due_date: date | None = None
    # "direct" when assigned straight to me, otherwise the cohort's name.
    source: str
    # My most recent progress report on this plan (None until I submit one).
    latest_status: str | None = None
    last_report_at: datetime | None = None


class MyPlanList(BaseModel):
    items: list[MyPlanOut]


class NotificationOut(BaseModel):
    id: UUID
    message: str
    is_read: bool
    plan_id: UUID | None = None
    created_at: datetime


class NotificationList(BaseModel):
    items: list[NotificationOut]
    total: int
    limit: int
    offset: int
    # All of this user's unread notifications, not just the current page.
    unread_count: int
