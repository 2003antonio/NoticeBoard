from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_role
from app.schemas.dashboard import CohortList, StatusFilter, SummaryOut, TraineeList
from app.services import dashboard_service

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

manager = require_role("manager")


@router.get("/summary", response_model=SummaryOut)
def summary(user=Depends(manager), conn=Depends(get_db)):
    return dashboard_service.summary(conn)


@router.get("/cohorts", response_model=CohortList)
def cohorts(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(manager),
    conn=Depends(get_db),
):
    items, total = dashboard_service.cohort_rows(conn, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/trainees", response_model=TraineeList)
def trainees(
    cohort_id: UUID | None = Query(None),
    plan_id: UUID | None = Query(None),
    trainee_id: UUID | None = Query(None),
    attention_only: bool = Query(False),
    status: StatusFilter | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(manager),
    conn=Depends(get_db),
):
    # Unknown ids simply match no pairs (an empty list), which is not an error.
    items, total = dashboard_service.trainee_pairs(
        conn, limit, offset,
        cohort_id=cohort_id, plan_id=plan_id, trainee_id=trainee_id,
        attention_only=attention_only,
        status=status.value if status else None,
    )
    return {"items": items, "total": total, "limit": limit, "offset": offset}
