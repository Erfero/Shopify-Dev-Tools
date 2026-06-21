"""Image generation via Pollinations.ai — FLUX Realism (free, no API key required)."""
import asyncio
import base64
import logging
import random
import urllib.parse

import httpx

logger = logging.getLogger(__name__)

_LANDSCAPE_W, _LANDSCAPE_H = 1344, 768   # 16:9
_PORTRAIT_W,  _PORTRAIT_H  = 768, 1024   # 3:4

# Photorealism suffix added to every prompt
_REALISM_SUFFIX = (
    ", ultra realistic product photography, professional studio lighting, "
    "shot on Canon EOS 5D Mark IV, 85mm lens f/1.8, shallow depth of field, "
    "8k resolution, commercial quality, sharp focus, natural skin tones, "
    "lifestyle photography, Vogue magazine quality"
)


def _build_url(prompt: str, width: int, height: int) -> str:
    full_prompt = prompt + _REALISM_SUFFIX
    encoded = urllib.parse.quote(full_prompt)
    seed = random.randint(1, 999999)
    return (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width={width}&height={height}"
        f"&model=flux-realism"
        f"&nologo=true"
        f"&enhance=true"
        f"&seed={seed}"
    )


async def _fetch_one(
    client: httpx.AsyncClient,
    prompt: str,
    width: int,
    height: int,
    orientation: str,
    sem: asyncio.Semaphore,
) -> dict | None:
    async with sem:
        url = _build_url(prompt, width, height)
        try:
            resp = await client.get(url)
            resp.raise_for_status()
            content_type = resp.headers.get("content-type", "image/jpeg").split(";")[0].strip()
            b64 = base64.b64encode(resp.content).decode()
            data_uri = f"data:{content_type};base64,{b64}"
            return {"url": data_uri, "orientation": orientation}
        except Exception as e:
            logger.warning("Pollinations fetch failed (%s×%s): %s", width, height, e)
            return None


async def generate_dalle_images(
    prompt: str,
    landscape_count: int = 2,
    portrait_count: int = 8,
) -> list[dict]:
    """Generate landscape + portrait images via Pollinations.ai FLUX Realism (free).

    Downloads each image in the backend so the frontend receives ready-to-display
    base64 data URIs instead of slow on-demand Pollinations URLs.
    """
    tasks = (
        [(_LANDSCAPE_W, _LANDSCAPE_H, "landscape")] * landscape_count
        + [(_PORTRAIT_W, _PORTRAIT_H, "portrait")] * portrait_count
    )

    sem = asyncio.Semaphore(3)

    async with httpx.AsyncClient(timeout=120) as client:
        results = await asyncio.gather(
            *[_fetch_one(client, prompt, w, h, o, sem) for w, h, o in tasks],
            return_exceptions=True,
        )

    return [r for r in results if r and not isinstance(r, Exception)]
