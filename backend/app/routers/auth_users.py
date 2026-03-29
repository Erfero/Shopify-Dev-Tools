import uuid

import bcrypt
from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel

from app.auth import create_access_token, verify_token
from app.config import settings
from app.database import (
    create_user,
    get_user_by_email,
    get_user_by_id,
    get_all_users,
    update_user_status,
    update_user_profile,
    admin_update_user,
    delete_user,
    log_activity,
    _display_name_from_email,
)
from app.email_utils import send_approval_email

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()


def _verify_password(password: str, hashed: str) -> bool:
    return bcrypt.checkpw(password.encode(), hashed.encode())


class RegisterRequest(BaseModel):
    email: str
    password: str
    display_name: str = ""


class LoginRequest(BaseModel):
    email: str
    password: str


class UpdateProfileRequest(BaseModel):
    display_name: str | None = None
    current_password: str | None = None
    new_password: str | None = None


class AdminEditUserRequest(BaseModel):
    email: str | None = None
    display_name: str | None = None
    new_password: str | None = None


@router.post("/register")
async def register(req: RegisterRequest):
    if len(req.password) < 6:
        raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères.")

    existing = await get_user_by_email(req.email.lower())
    if existing:
        raise HTTPException(status_code=400, detail="Cet email est déjà utilisé.")

    is_admin = bool(settings.admin_email and req.email.lower() == settings.admin_email.lower())
    is_approved = is_admin  # admin auto-approuvé, les autres attendent

    # Use provided display_name or auto-generate from email
    display_name = req.display_name.strip() or _display_name_from_email(req.email)

    user_id = str(uuid.uuid4())
    password_hash = _hash_password(req.password)
    await create_user(user_id, req.email.lower(), password_hash, is_approved, is_admin, display_name)

    await log_activity(req.email.lower(), "register")

    if is_approved:
        token = create_access_token({
            "sub": user_id,
            "email": req.email.lower(),
            "display_name": display_name,
            "is_admin": True,
            "is_approved": True,
        })
        return {"access_token": token, "token_type": "bearer", "is_admin": True, "display_name": display_name}

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
        "display_name": user.get("display_name") or _display_name_from_email(user["email"]),
        "is_admin": user["is_admin"],
        "is_approved": True,
    })
    await log_activity(user["email"], "login")
    return {
        "access_token": token,
        "token_type": "bearer",
        "is_admin": user["is_admin"],
        "display_name": user.get("display_name") or _display_name_from_email(user["email"]),
    }


@router.get("/me")
async def me(current_user: dict = Depends(verify_token)):
    return {
        "email": current_user.get("email"),
        "display_name": current_user.get("display_name", ""),
        "is_admin": current_user.get("is_admin", False),
    }


@router.patch("/profile")
async def update_profile(req: UpdateProfileRequest, current_user: dict = Depends(verify_token)):
    """Update the current user's display_name and/or password."""
    user = await get_user_by_id(current_user["sub"])
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    new_display_name: str | None = None
    new_password_hash: str | None = None

    if req.display_name is not None:
        stripped = req.display_name.strip()
        if stripped:
            new_display_name = stripped

    if req.new_password:
        if not req.current_password:
            raise HTTPException(status_code=400, detail="Mot de passe actuel requis.")
        if not _verify_password(req.current_password, user["password_hash"]):
            raise HTTPException(status_code=400, detail="Mot de passe actuel incorrect.")
        if len(req.new_password) < 6:
            raise HTTPException(status_code=400, detail="Le nouveau mot de passe doit contenir au moins 6 caractères.")
        new_password_hash = _hash_password(req.new_password)

    if new_display_name is None and new_password_hash is None:
        raise HTTPException(status_code=400, detail="Aucune modification à effectuer.")

    await update_user_profile(current_user["sub"], display_name=new_display_name, password_hash=new_password_hash)
    return {
        "status": "updated",
        "display_name": new_display_name or user["display_name"],
    }


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
    user = await get_user_by_id(user_id)
    if user:
        await send_approval_email(
            to_email=user["email"],
            display_name=user.get("display_name") or _display_name_from_email(user["email"]),
        )
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


@router.patch("/users/{user_id}/edit")
async def edit_user(user_id: str, req: AdminEditUserRequest, current_user: dict = Depends(_require_admin)):
    """Admin: update email, display_name, and/or password for any user."""
    user = await get_user_by_id(user_id)
    if not user:
        raise HTTPException(status_code=404, detail="Utilisateur introuvable.")

    new_email: str | None = None
    new_display_name: str | None = None
    new_password_hash: str | None = None

    if req.email is not None:
        stripped_email = req.email.strip().lower()
        if stripped_email and stripped_email != user["email"]:
            existing = await get_user_by_email(stripped_email)
            if existing and existing["id"] != user_id:
                raise HTTPException(status_code=400, detail="Cet email est déjà utilisé par un autre compte.")
            new_email = stripped_email

    if req.display_name is not None:
        stripped_name = req.display_name.strip()
        if stripped_name and stripped_name != user["display_name"]:
            new_display_name = stripped_name

    if req.new_password:
        if len(req.new_password) < 6:
            raise HTTPException(status_code=400, detail="Le mot de passe doit contenir au moins 6 caractères.")
        new_password_hash = _hash_password(req.new_password)

    if new_email is None and new_display_name is None and new_password_hash is None:
        raise HTTPException(status_code=400, detail="Aucune modification à effectuer.")

    await admin_update_user(user_id, email=new_email, display_name=new_display_name, password_hash=new_password_hash)
    return {"status": "updated"}


@router.delete("/users/{user_id}")
async def remove_user(user_id: str, current_user: dict = Depends(_require_admin)):
    if current_user.get("sub") == user_id:
        raise HTTPException(status_code=400, detail="Vous ne pouvez pas supprimer votre propre compte depuis l'admin.")
    await delete_user(user_id)
    return {"status": "deleted"}
