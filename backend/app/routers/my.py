from fastapi import APIRouter, Depends

from app.database import get_db
from app.dependencies import require_role
from app.schemas.plan import MyPlanList
from app.services import plan_service

router = APIRouter(prefix="/my", tags=["my"])


@router.get("/plans", response_model=MyPlanList)
def my_plans(user=Depends(require_role("trainee")), conn=Depends(get_db)):
    # Intentionally not paginated: one trainee's assigned plans are naturally
    # bounded. See Architecture.md.
    return {"items": plan_service.my_plans(conn, user["id"])}
