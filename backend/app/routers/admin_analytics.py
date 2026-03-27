from fastapi import APIRouter, Depends, HTTPException, Query

from app.auth import verify_token
from app.database import get_activity_log, get_activity_stats, get_my_action_counts

router = APIRouter(prefix="/api/admin", tags=["admin"])


@router.get("/my-stats")
async def my_stats(current_user: dict = Depends(verify_token)):
    """Counts per action type for the current user (no pagination)."""
    return await get_my_action_counts(current_user["email"])


@router.get("/my-activity")
async def my_activity(
    limit: int = Query(default=20, le=200),
    offset: int = Query(default=0, ge=0),
    actions: list[str] | None = Query(default=None),
    current_user: dict = Depends(verify_token),
):
    """Historique personnel de l'utilisateur connecté."""
    logs = await get_activity_log(limit=limit, offset=offset, user_email=current_user["email"], actions=actions or None)
    return logs


def _require_admin(current_user: dict = Depends(verify_token)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur.")
    return current_user


@router.get("/activity")
async def activity_log(
    limit: int = Query(default=30, le=500),
    offset: int = Query(default=0, ge=0),
    user_email: str | None = Query(default=None),
    current_user: dict = Depends(_require_admin),
):
    """Journal complet des actions utilisateurs."""
    logs = await get_activity_log(limit=limit, offset=offset, user_email=user_email or None)
    return logs


@router.get("/stats")
async def analytics_stats(current_user: dict = Depends(_require_admin)):
    """Stats agrégées pour le dashboard admin."""
    return await get_activity_stats()
