from fastapi import Header, HTTPException

from app.config import settings


def verify_token(x_api_token: str = Header(default="")) -> None:
    """Vérifie le token d'API si API_TOKEN est configuré dans .env."""
    if settings.api_token and x_api_token != settings.api_token:
        raise HTTPException(status_code=401, detail="Token d'API invalide ou manquant.")
