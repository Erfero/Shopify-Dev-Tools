"""DALL-E 3 image generation via OpenRouter."""
import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)


async def generate_dalle_images(
    prompt: str,
    landscape_count: int = 2,
    portrait_count: int = 8,
) -> list[dict]:
    """
    Generate landscape + portrait images with DALL-E 3 via OpenRouter.
    Landscape: 1792x1024 (16:9) — Portrait: 1024x1792 (~9:16).
    """
    configs = (
        [("1792x1024", "landscape")] * landscape_count +
        [("1024x1792", "portrait")] * portrait_count
    )

    async def _one(client: httpx.AsyncClient, size: str, orientation: str) -> dict:
        resp = await client.post(
            "https://openrouter.ai/api/v1/images/generations",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.frontend_url,
            },
            json={
                "model": "openai/dall-e-3",
                "prompt": prompt,
                "n": 1,
                "size": size,
                "response_format": "url",
            },
        )
        resp.raise_for_status()
        data = resp.json()
        img = data["data"][0]
        return {
            "url": img["url"],
            "thumb": img["url"],
            "revised_prompt": img.get("revised_prompt", prompt),
            "orientation": orientation,
        }

    async with httpx.AsyncClient(timeout=120) as client:
        results = await asyncio.gather(
            *[_one(client, size, orient) for size, orient in configs],
            return_exceptions=True,
        )

    images = []
    for i, r in enumerate(results):
        if isinstance(r, Exception):
            logger.warning("DALL-E generation %d failed: %s", i, r)
        else:
            images.append(r)
    return images
