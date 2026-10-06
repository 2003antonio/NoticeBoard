from fastapi import APIRouter, Depends

from app.database import get_db

router = APIRouter(tags=["health"])


@router.get("/health")
def health(conn=Depends(get_db)):
    conn.execute("SELECT 1")
    return {"status": "ok"}
