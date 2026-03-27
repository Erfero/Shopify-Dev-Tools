from fastapi import Header, HTTPException
from jose import jwt, JWTError

from app.config import settings

_ALGORITHM = "HS256"


def create_access_token(payload: dict) -> str:
    """Create a JWT with no expiry — tokens are only invalidated by secret rotation."""
    return jwt.encode(payload.copy(), settings.jwt_secret, algorithm=_ALGORITHM)


def _decode_jwt(token: str) -> dict:
    try:
        return jwt.decode(token, settings.jwt_secret, algorithms=[_ALGORITHM])
    except JWTError:
        raise HTTPException(status_code=401, detail="Token invalide ou expiré. Veuillez vous reconnecter.")


async def verify_token(
    authorization: str = Header(default=""),
    x_api_token: str = Header(default=""),
) -> dict:
    """Accepte un JWT Bearer token ou le legacy X-API-Token."""
    if authorization.startswith("Bearer "):
        token = authorization[7:]
        payload = _decode_jwt(token)
        if not payload.get("is_approved"):
            raise HTTPException(status_code=403, detail="Compte en attente d'approbation par l'administrateur.")
        return payload

    # Legacy API_TOKEN fallback (accès direct sans compte)
    if settings.api_token and x_api_token == settings.api_token:
        return {"sub": "legacy-admin", "email": "admin", "is_admin": True, "is_approved": True}

    raise HTTPException(status_code=401, detail="Authentification requise. Veuillez vous connecter.")
