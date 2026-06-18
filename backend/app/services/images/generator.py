"""Image generation via Together AI — FLUX.1-schnell (free tier available)."""
import asyncio
import logging

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_TOGETHER_URL = "https://api.together.xyz/v1/images/generations"
_MODEL = "black-forest-labs/FLUX.1-schnell-Free"

# Sizes: multiples of 32, closest to desired aspect ratio
_LANDSCAPE_W, _LANDSCAPE_H = 1344, 768   # 16:9
_PORTRAIT_W,  _PORTRAIT_H  = 768, 1024   # 3:4


async def _generate_one(
    client: httpx.AsyncClient,
    prompt: str,
    width: int,
    height: int,
    orientation: str,
    sem: asyncio.Semaphore,
) -> dict | None:
    async with sem:
        try:
            resp = await client.post(
                _TOGETHER_URL,
                headers={"Authorization": f"Bearer {settings.together_api_key}"},
                json={
                    "model": _MODEL,
                    "prompt": prompt,
                    "width": width,
                    "height": height,
                    "steps": 4,
                    "n": 1,
                },
            )
            resp.raise_for_status()
            data = resp.json()
            url = data["data"][0]["url"]
            return {"url": url, "orientation": orientation}
        except Exception as e:
            logger.warning("FLUX generation failed (%s×%s): %s", width, height, e)
            return None


async def generate_dalle_images(
    prompt: str,
    landscape_count: int = 2,
    portrait_count: int = 8,
) -> list[dict]:
    """Generate landscape + portrait images with FLUX via Together AI."""
    if not settings.together_api_key:
        raise Exception(
            "Clé Together AI manquante. Ajoute TOGETHER_API_KEY dans les variables d'environnement Render."
        )

    tasks = (
        [(_LANDSCAPE_W, _LANDSCAPE_H, "landscape")] * landscape_count
        + [(_PORTRAIT_W, _PORTRAIT_H, "portrait")] * portrait_count
    )

    # Limit to 4 concurrent requests to stay within rate limits
    sem = asyncio.Semaphore(4)

    async with httpx.AsyncClient(timeout=120) as client:
        results = await asyncio.gather(
            *[_generate_one(client, prompt, w, h, o, sem) for w, h, o in tasks],
            return_exceptions=True,
        )

    images = []
    for r in results:
        if r and not isinstance(r, Exception):
            images.append(r)
    return images
