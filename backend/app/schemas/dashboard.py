from datetime import date, datetime
from enum import Enum
from uuid import UUID

from pydantic import BaseModel


class StatusFilter(str, Enum):
    """The values latest_status can take, usable as the ?status= filter.

    An enum means an unknown value is rejected as a 400 by request validation,
    never reaching the query or causing a 500.
    """

    on_track = "on_track"
    blocked = "blocked"
    done = "done"
    no_report = "no_report"


class SummaryOut(BaseModel):
    total_pairs: int
    done: int
    on_track: int
    blocked: int
    no_report: int
    overdue: int
    missing: int
    needs_attention: int
    active_trainees: int
    cohorts: int
    plans: int
    completion_percent: float


class CohortRow(BaseModel):
    cohort_id: UUID
    name: str
    member_count: int
    plan_count: int
    total_pairs: int
    done: int
    blocked: int
    overdue: int
    missing: int
    needs_attention: int
    completion_percent: float


class CohortList(BaseModel):
    items: list[CohortRow]
    total: int
    limit: int
    offset: int


class TraineePairOut(BaseModel):
    trainee_id: UUID
    trainee_name: str
    trainee_email: str
    plan_id: UUID
    plan_title: str
    due_date: date | None = None
    latest_status: str
    last_report_at: datetime | None = None
    is_done: bool
    is_overdue: bool
    is_missing: bool
    needs_attention: bool
    source: str


class TraineeList(BaseModel):
    items: list[TraineePairOut]
    total: int
    limit: int
    offset: int
