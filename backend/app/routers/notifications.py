from uuid import UUID

from fastapi import APIRouter, Depends, Query

from app.database import get_db
from app.dependencies import get_current_user
from app.schemas.plan import NotificationList, NotificationOut
from app.services import notification_service

router = APIRouter(prefix="/notifications", tags=["notifications"])


@router.get("", response_model=NotificationList)
def list_notifications(
    unread_only: bool = Query(False),
    limit: int = Query(50, ge=1, le=100),
    offset: int = Query(0, ge=0),
    user=Depends(get_current_user),
    conn=Depends(get_db),
):
    # Any logged-in user, but only ever their own notifications.
    return notification_service.list_mine(conn, user["id"], unread_only, limit, offset)


@router.patch("/{notification_id}/read", response_model=NotificationOut)
def mark_read(notification_id: UUID, user=Depends(get_current_user), conn=Depends(get_db)):
    return notification_service.mark_read(conn, user["id"], notification_id)
