from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import require_role
from app.schemas.plan import MyPlanList
from app.schemas.report import ReportCreate, ReportList, ReportOut
from app.services import plan_service, report_service

router = APIRouter(prefix="/my", tags=["my"])

trainee = require_role("trainee")


@router.get("/plans", response_model=MyPlanList)
def my_plans(user=Depends(trainee), conn=Depends(get_db)):
    # Intentionally not paginated: one trainee's assigned plans are naturally
    # bounded. See Architecture.md.
    return {"items": plan_service.my_plans(conn, user["id"])}


@router.post("/plans/{plan_id}/reports", response_model=ReportOut, status_code=201)
def submit_report(plan_id: UUID, body: ReportCreate, user=Depends(trainee), conn=Depends(get_db)):
    return report_service.submit(conn, user["id"], plan_id, body.status, body.notes)


@router.get("/plans/{plan_id}/reports", response_model=ReportList)
def my_reports(
    plan_id: UUID,
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(trainee),
    conn=Depends(get_db),
):
    items, total = report_service.list_mine(conn, user["id"], plan_id, limit, offset)
    return {"items": items, "total": total, "limit": limit, "offset": offset}
