from pydantic import BaseModel, EmailStr
from typing import Optional


class UploadResponse(BaseModel):
    session_id: str
    theme_name: str
    sections_count: int
    templates_found: list[str]


class GenerateRequest(BaseModel):
    session_id: str
    store_name: str
    store_email: str
    product_names: list[str]
    product_description: Optional[str] = None
    language: str = "fr"
    target_gender: str = "femme"           # femme | homme | mixte
    product_price: Optional[str] = None    # ex: "29.99"
    store_address: Optional[str] = None    # for legal pages
    siret: Optional[str] = None            # for mentions légales
    delivery_delay: str = "3-5 jours ouvrés"
    return_policy_days: str = "30"
    marketing_angles: Optional[str] = None


class GenerationStep(BaseModel):
    step: str
    status: str  # "generating", "done", "error"
    message: str
    data: Optional[dict] = None


class PreviewResponse(BaseModel):
    texts: dict


class HealthResponse(BaseModel):
    status: str
    version: str
