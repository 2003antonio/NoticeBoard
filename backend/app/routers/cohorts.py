from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_role
from app.schemas.cohort import AddMember, CohortCreate, CohortList, CohortOut, MemberList
from app.services import cohort_service

router = APIRouter(prefix="/cohorts", tags=["cohorts"])

staff = require_role("hr", "manager")


@router.post("", response_model=CohortOut, status_code=201)
def create_cohort(body: CohortCreate, user=Depends(staff), conn=Depends(get_db)):
    return cohort_service.create_cohort(conn, body.name, user["id"])


@router.get("", response_model=CohortList)
def list_cohorts(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(staff),
    conn=Depends(get_db),
):
    items, total = cohort_service.list_cohorts(conn, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{cohort_id}/members", response_model=MemberList)
def list_members(cohort_id: UUID, user=Depends(staff), conn=Depends(get_db)):
    return {"items": cohort_service.list_members(conn, cohort_id)}


@router.post("/{cohort_id}/members", response_model=MemberList, status_code=201)
def add_member(cohort_id: UUID, body: AddMember, user=Depends(staff), conn=Depends(get_db)):
    cohort_service.add_member(conn, cohort_id, body.trainee_id)
    return {"items": cohort_service.list_members(conn, cohort_id)}
