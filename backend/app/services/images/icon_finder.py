"""Product icon finder — maps product benefits to Lucide SVG icons."""
import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

_ICON_LIST = [
    "droplets", "sun", "moon", "star", "sparkles", "eye", "smile", "heart",
    "activity", "shield-check", "zap", "leaf", "award", "check-circle-2",
    "gem", "clock", "timer", "trending-up", "refresh-cw", "target", "feather",
    "sprout", "atom", "wind", "snowflake", "flame", "thumbs-up", "layers",
    "package", "gift", "crown", "dna", "microscope", "hand", "scan-line",
    "badge-check", "circle-check-big", "flower-2", "rainbow", "shield",
]

_SYSTEM = (
    "Tu es un expert en design iconographique et en marketing e-commerce. "
    "Tu choisis des icônes SVG Lucide parfaitement adaptées aux avantages produit."
)

_PROMPT = """Produit : {name}
Description / bénéfices : {desc}
Angles marketing : {angles}

Génère exactement {n} icônes représentant les principaux avantages et bénéfices de ce produit.
Pour chaque icône, choisis LE nom le plus adapté dans cette liste Lucide uniquement :
{icons}

Retourne UNIQUEMENT ce JSON valide (pas de markdown, pas de texte autour) :
[
  {{"label": "Hydratation intense", "icon": "droplets", "benefit": "Hydrate la peau en profondeur"}},
  {{"label": "Éclat naturel", "icon": "sun", "benefit": "Illumine et uniforme le teint"}}
]"""


async def find_product_icons(
    product_name: str,
    product_description: str,
    marketing_angles: str = "",
    n: int = 5,
) -> list[dict]:
    """Generate n benefit icons mapped to Lucide SVGs."""
    prompt = _PROMPT.format(
        name=product_name,
        desc=product_description or "Non renseignée",
        angles=marketing_angles or "Non renseignés",
        n=n,
        icons=", ".join(_ICON_LIST),
    )

    async with httpx.AsyncClient(timeout=30) as client:
        resp = await client.post(
            "https://openrouter.ai/api/v1/chat/completions",
            headers={
                "Authorization": f"Bearer {settings.openrouter_api_key}",
                "Content-Type": "application/json",
                "HTTP-Referer": settings.frontend_url,
            },
            json={
                "model": settings.vision_model,
                "messages": [
                    {"role": "system", "content": _SYSTEM},
                    {"role": "user", "content": prompt},
                ],
                "max_tokens": 800,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())
    icon_data: list[dict] = json.loads(raw)

    # Fetch SVGs in parallel
    async with httpx.AsyncClient(timeout=15) as client:
        svgs = await _fetch_svgs(client, [item.get("icon", "star") for item in icon_data[:n]])

    results = []
    for i, item in enumerate(icon_data[:n]):
        icon_name = item.get("icon", "star")
        svg = svgs.get(icon_name, "")
        if not svg:
            svg = svgs.get("star", "")
        results.append({
            "label": item.get("label", ""),
            "icon": icon_name,
            "benefit": item.get("benefit", ""),
            "svg": svg,
        })

    return results


async def _fetch_svgs(client: httpx.AsyncClient, icon_names: list[str]) -> dict[str, str]:
    """Fetch multiple Lucide SVGs in parallel."""
    import asyncio

    async def _one(name: str) -> tuple[str, str]:
        try:
            r = await client.get(
                f"https://unpkg.com/lucide-static@latest/icons/{name}.svg",
                follow_redirects=True,
            )
            if r.status_code == 200:
                svg = r.text
                # Make scalable
                svg = re.sub(r'width="\d+"', 'width="100%"', svg)
                svg = re.sub(r'height="\d+"', 'height="100%"', svg)
                return name, svg
        except Exception as e:
            logger.warning("Failed to fetch icon %r: %s", name, e)
        return name, ""

    pairs = await asyncio.gather(*[_one(n) for n in icon_names])
    return dict(pairs)
