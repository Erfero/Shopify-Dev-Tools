import httpx
import base64
import os
import uuid
from typing import Optional

from app.config import settings

IMGBB_API_URL = "https://api.imgbb.com/1/upload"


async def upload_to_imgbb(image_data: bytes, filename: str) -> Optional[str]:
    """Upload an image to imgbb and return the public URL."""
    if not settings.IMGBB_API_KEY:
        return None

    b64_image = base64.b64encode(image_data).decode("utf-8")

    async with httpx.AsyncClient(timeout=30.0) as client:
        response = await client.post(
            IMGBB_API_URL,
            data={
                "key": settings.IMGBB_API_KEY,
                "image": b64_image,
                "name": filename,
            },
        )
        response.raise_for_status()
        data = response.json()

        if data.get("success"):
            return data["data"]["url"]

    return None


async def save_image_locally(image_data: bytes, filename: str) -> str:
    """Save image to the uploads directory and return local URL."""
    uploads_dir = os.path.join(
        os.path.dirname(__file__), "..", "..", "..", "..", "uploads"
    )
    os.makedirs(uploads_dir, exist_ok=True)

    ext = os.path.splitext(filename)[1] or ".jpg"
    unique_name = f"{uuid.uuid4().hex}{ext}"
    file_path = os.path.join(uploads_dir, unique_name)

    with open(file_path, "wb") as f:
        f.write(image_data)

    return f"{settings.BACKEND_URL}/uploads/{unique_name}"


async def process_image(image_data: bytes, filename: str) -> str:
    """
    Upload image to imgbb if API key is available, otherwise save locally.
    Returns public URL.
    """
    if settings.IMGBB_API_KEY:
        url = await upload_to_imgbb(image_data, filename)
        if url:
            return url

    return await save_image_locally(image_data, filename)
