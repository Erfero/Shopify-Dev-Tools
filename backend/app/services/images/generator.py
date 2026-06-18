"""Image generation via Pollinations.ai — FLUX (free, no API key required)."""
import random
import urllib.parse

_LANDSCAPE_W, _LANDSCAPE_H = 1344, 768   # 16:9
_PORTRAIT_W,  _PORTRAIT_H  = 768, 1024   # 3:4


def _build_url(prompt: str, width: int, height: int) -> str:
    encoded = urllib.parse.quote(prompt)
    seed = random.randint(1, 999999)
    return (
        f"https://image.pollinations.ai/prompt/{encoded}"
        f"?width={width}&height={height}&model=flux&nologo=true&seed={seed}"
    )


async def generate_dalle_images(
    prompt: str,
    landscape_count: int = 2,
    portrait_count: int = 8,
) -> list[dict]:
    """Generate landscape + portrait images via Pollinations.ai (free, no API key)."""
    images = []

    for _ in range(landscape_count):
        images.append({"url": _build_url(prompt, _LANDSCAPE_W, _LANDSCAPE_H), "orientation": "landscape"})

    for _ in range(portrait_count):
        images.append({"url": _build_url(prompt, _PORTRAIT_W, _PORTRAIT_H), "orientation": "portrait"})

    return images
