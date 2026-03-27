import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import create_access_token, verify_token
from app.config import settings
from app.database import (
    create_user,
    get_user_by_email,
    get_all_users,
    update_user_status,
    delete_user,
    log_activity,
)

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères.")

    existing = await get_user_by_email(req.email.lower())
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    is_admin = bool(settings.admin_email and req.email.lower() == settings.admin_email.lower())
    is_approved = is_admin  # admin auto-approuvé, les autres attendent

    user_id = str(uuid.uuid4())
    password_hash = _hash_password(req.password)
    await create_user(user_id, req.email.lower(), password_hash, is_approved, is_admin)

    await log_activity(req.email.lower(), "register")

    if is_approved:
        token = create_access_token({
            "sub": user_id,
            "email": req.email.lower(),
            "is_admin": True,
            "is_approved": True,
        })
        return {"access_token": token, "token_type": "bearer", "is_admin": True}

    return {"message": "Compte créé avec succès. En attente d'approbation par l'administrateur."}


@router.post("/login")
async def login(req: LoginRequest):
    user = await get_user_by_email(req.email.lower())
    if not user or not _verify_password(req.password, user["password_hash"]):
        raise HTTPException(status_code=401, detail="Email ou mot de passe incorrect.")

    if not user["is_approved"]:
        raise HTTPException(status_code=403, detail="Votre compte est en attente d'approbation par l'administrateur.")

    token = create_access_token({
        "sub": user["id"],
        "email": user["email"],
        "is_admin": user["is_admin"],
        "is_approved": True,
    })
    await log_activity(user["email"], "login")
    return {"access_token": token, "token_type": "bearer", "is_admin": user["is_admin"]}


@router.get("/me")
async def me(current_user: dict = Depends(verify_token)):
    return {"email": current_user.get("email"), "is_admin": current_user.get("is_admin", False)}


# ── Admin endpoints ────────────────────────────────────────────────────────────

def _require_admin(current_user: dict = Depends(verify_token)) -> dict:
    if not current_user.get("is_admin"):
        raise HTTPException(status_code=403, detail="Accès réservé à l'administrateur.")
    return current_user


@router.get("/users")
async def list_users(current_user: dict = Depends(_require_admin)):
    users = await get_all_users()
    return users


@router.patch("/users/{user_id}/approve")
async def approve_user(user_id: str, current_user: dict = Depends(_require_admin)):
    await update_user_status(user_id, is_approved=True)
    return {"status": "approved"}


@router.patch("/users/{user_id}/reject")
async def reject_user(user_id: str, current_user: dict = Depends(_require_admin)):
    await update_user_status(user_id, is_approved=False)
    return {"status": "rejected"}


@router.patch("/users/{user_id}/promote")
async def promote_user(user_id: str, current_user: dict = Depends(_require_admin)):
    await update_user_status(user_id, is_admin=True, is_approved=True)
    return {"status": "promoted"}


@router.patch("/users/{user_id}/demote")
async def demote_user(user_id: str, current_user: dict = Depends(_require_admin)):
    if current_user.get("sub") == user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas vous retirer vous-même le rôle d'admin.")
    await update_user_status(user_id, is_admin=False)
    return {"status": "demoted"}


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, current_user: dict = Depends(_require_admin)):
    if current_user.get("sub") == user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte depuis l'admin.")
    await delete_user(user_id)
    return {"status": "deleted"}
