from uuid import UUID

from fastapi import APIRouter, Depends, Query, Response

from app.database import get_db
from app.dependencies import require_role
from app.schemas.trainee import TraineeCreate, TraineeCreated, TraineeList
from app.services import trainee_service

router = APIRouter(prefix="/trainees", tags=["trainees"])


@router.post("", response_model=TraineeCreated, status_code=201)
def onboard_trainee(
    body: TraineeCreate,
    response: Response,
    user=Depends(require_role("hr")),
    conn=Depends(get_db),
):
    trainee, temp_password = trainee_service.onboard(conn, body.name, body.email)
    response.headers["Cache-Control"] = "no-store"  # this response contains a password
    return {"trainee": trainee, "temporary_password": temp_password}


@router.get("", response_model=TraineeList)
def list_trainees(
    not_in_cohort: UUID | None = Query(None),
    not_assigned_plan: UUID | None = Query(None),
    q: str | None = Query(None, max_length=100),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(require_role("hr", "manager")),
    conn=Depends(get_db),
):
    # Optional filters power the "only offer what's available" pickers; with none
    # set this behaves exactly as before. Unknown ids simply match nothing.
    items, total = trainee_service.list_trainees(conn, limit, offset, not_in_cohort, not_assigned_plan, q)
    return {"items": items, "total": total, "limit": limit, "offset": offset}
