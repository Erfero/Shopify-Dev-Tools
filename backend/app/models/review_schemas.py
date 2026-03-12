from pydantic import BaseModel
from typing import Optional, List


class GenerationRequest(BaseModel):
    product_name: str
    brand_name: str
    product_description: str
    product_handle: str
    target_gender: str  # "femmes" | "hommes" | "mixte"
    language: str
    review_count: int = 100
    session_id: str


class ReviewItem(BaseModel):
    author: str
    review: str
    reply: str
    image_url: Optional[str] = None


class GenerationEvent(BaseModel):
    type: str  # "start" | "progress" | "complete" | "error"
    message: str
    progress: int = 0
    count: Optional[int] = None
    session_id: Optional[str] = None
