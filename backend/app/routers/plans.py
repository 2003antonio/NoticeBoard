from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_role
from app.schemas.plan import AssignmentCreate, AssignmentOut, PlanCreate, PlanList, PlanOut
from app.schemas.report import PlanReportList
from app.services import plan_service, report_service

router = APIRouter(prefix="/plans", tags=["plans"])

manager = require_role("manager")


@router.post("", response_model=PlanOut, status_code=201)
def create_plan(body: PlanCreate, user=Depends(manager), conn=Depends(get_db)):
    return plan_service.create_plan(conn, body.title, body.description, body.due_date, user["id"])


@router.get("", response_model=PlanList)
def list_plans(
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(manager),
    conn=Depends(get_db),
):
    items, total = plan_service.list_plans(conn, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}


@router.get("/{plan_id}", response_model=PlanOut)
def get_plan(plan_id: UUID, user=Depends(manager), conn=Depends(get_db)):
    return plan_service.get_plan(conn, plan_id)


@router.post("/{plan_id}/assignments", response_model=AssignmentOut, status_code=201)
def assign_plan(plan_id: UUID, body: AssignmentCreate, user=Depends(manager), conn=Depends(get_db)):
    return plan_service.assign(conn, plan_id, body.cohort_id, body.trainee_id)


@router.get("/{plan_id}/reports", response_model=PlanReportList)
def plan_reports(
    plan_id: UUID,
    trainee_id: UUID | None = Query(None),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(manager),
    conn=Depends(get_db),
):
    """All progress reports for a plan, newest first; optionally one trainee's."""
    items, total = report_service.list_for_plan(conn, plan_id, trainee_id, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}
