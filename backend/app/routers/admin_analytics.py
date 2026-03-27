from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import verify_token
from app.database import get_activity_log, get_activity_stats

router = APIRouter(prefix="/api/admin", tags=["admin"])


def _require_admin(current_user: dict = Depends(verify_token)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur.")
    return current_user


@router.get("/activity")
async def activity_log(
    limit: int = Query(default=200, le=500),
    user_email: str | None = Query(default=None),
    current_user: dict = Depends(_require_admin),
):
    """Journal complet des actions utilisateurs."""
    logs = await get_activity_log(limit=limit, user_email=user_email or None)
    return logs


@router.get("/stats")
async def analytics_stats(current_user: dict = Depends(_require_admin)):
    """Stats agrégées pour le dashboard admin."""
    return await get_activity_stats()
