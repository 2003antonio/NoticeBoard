from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_role
from app.schemas.cohort import (
    AddMember,
    CohortCreate,
    CohortList,
    CohortOut,
    CohortPlanList,
    MemberList,
)
from app.services import cohort_service

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

staff = require_role("hr", "manager")
manager = require_role("manager")


@router.post("", response_model=CohortOut, status_code=201)
def create_cohort(body: CohortCreate, user=Depends(staff), conn=Depends(get_db)):
    return cohort_service.create_cohort(conn, body.name, user["id"])


@router.get("", response_model=CohortList)
def list_cohorts(
    not_assigned_plan: UUID | None = Query(None),
    q: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(staff),
    conn=Depends(get_db),
):
    # not_assigned_plan hides cohorts that already have the plan (for the plan
    # page's "assign to a cohort" picker); no filter = behaviour unchanged.
    items, total = cohort_service.list_cohorts(conn, limit, offset, not_assigned_plan, q)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{cohort_id}/plans", response_model=CohortPlanList)
def list_cohort_plans(
    cohort_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(manager),
    conn=Depends(get_db),
):
    """Plans assigned to this cohort (manager only; HR has no plan access)."""
    items, total = cohort_service.list_cohort_plans(conn, cohort_id, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{cohort_id}/members", response_model=MemberList)
def list_members(cohort_id: UUID, user=Depends(staff), conn=Depends(get_db)):
    return {"items": cohort_service.list_members(conn, cohort_id)}


@router.post("/{cohort_id}/members", response_model=MemberList, status_code=201)
def add_member(cohort_id: UUID, body: AddMember, user=Depends(staff), conn=Depends(get_db)):
    cohort_service.add_member(conn, cohort_id, body.trainee_id)
    return {"items": cohort_service.list_members(conn, cohort_id)}
