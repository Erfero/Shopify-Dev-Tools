"""Product icon finder — maps product benefits to clean stroke SVG icons via Iconify JSON API."""
import asyncio
import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Stroke-based icon sets (clean line icons, no fills)
_ICON_SETS = ["tabler", "lucide", "mdi-light"]

_SYSTEM = (
    "Tu es un expert en design iconographique et en marketing e-commerce. "
    "Tu génères des labels, bénéfices et mots-clés d'icônes pour des avantages produit."
)

_PROMPT = """Produit : {name}
Description / bénéfices : {desc}
Angles marketing : {angles}

Génère exactement {n} icônes représentant les principaux avantages et bénéfices de ce produit.
Pour chaque icône :
- label : titre court (2-4 mots, en français)
- benefit : description du bénéfice (une phrase, en français)
- keyword : mot-clé EN ANGLAIS simple pour chercher l'icône (1-2 mots, ex: "sun", "shield", "leaf", "heart", "drop", "star", "clock", "gift", "rose", "spa", "smile", "trophy", "protect", "organic", "sparkle")

Retourne UNIQUEMENT ce JSON valide :
[
  {{"label": "Hydratation intense", "benefit": "Hydrate la peau en profondeur pendant 24h", "keyword": "drop"}},
  {{"label": "Protection solaire", "benefit": "Protège des rayons UV toute la journée", "keyword": "shield"}}
]"""


async def find_product_icons(
    product_name: str,
    product_description: str,
    marketing_angles: str = "",
    n: int = 5,
) -> list[dict]:
    """Generate n benefit icons with clean black stroke SVGs."""
    prompt = _PROMPT.format(
        name=product_name,
        desc=product_description or "Non renseignée",
        angles=marketing_angles or "Non renseignés",
        n=n,
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

    async with httpx.AsyncClient(timeout=15) as client:
        results = await asyncio.gather(*[
            _fetch_icon(client, item)
            for item in icon_data[:n]
        ])

    return list(results)


async def _fetch_icon(client: httpx.AsyncClient, item: dict) -> dict:
    """Search Iconify and build a clean SVG from JSON data."""
    keyword = item.get("keyword", "star")
    label = item.get("label", "")
    benefit = item.get("benefit", "")

    for icon_set in _ICON_SETS:
        result = await _try_fetch(client, keyword, icon_set, label, benefit)
        if result:
            return result
        # Try single word if keyword has spaces
        if " " in keyword:
            result = await _try_fetch(client, keyword.split()[0], icon_set, label, benefit)
            if result:
                return result

    return _fallback_icon(item)


async def _try_fetch(
    client: httpx.AsyncClient, keyword: str, icon_set: str, label: str, benefit: str
) -> dict | None:
    """Search for icon, then fetch its JSON data and build a clean SVG."""
    try:
        # Step 1: Search for the icon name
        r = await client.get(
            "https://api.iconify.design/search",
            params={"query": keyword, "limit": 3, "prefixes": icon_set},
        )
        if r.status_code != 200:
            return None
        icons = r.json().get("icons", [])
        if not icons:
            return None

        icon_id = icons[0]  # e.g. "tabler:sun"
        prefix, name = icon_id.split(":", 1)

        # Step 2: Fetch JSON data (reliable, gives us the raw path body)
        r2 = await client.get(
            f"https://api.iconify.design/{prefix}.json",
            params={"icons": name},
        )
        if r2.status_code != 200:
            return None

        data = r2.json()
        icon_info = data.get("icons", {}).get(name)
        if not icon_info:
            return None

        width = data.get("width", 24)
        height = data.get("height", 24)
        body = icon_info.get("body", "")
        if not body:
            return None

        # Step 3: Build clean SVG — we own the root, so fill/stroke are predictable
        svg = (
            f'<svg xmlns="http://www.w3.org/2000/svg" '
            f'viewBox="0 0 {width} {height}" width="100%" height="100%" '
            f'fill="none" stroke="currentColor" '
            f'stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
            f'{body}'
            f'</svg>'
        )

        return {"label": label, "icon": name, "benefit": benefit, "svg": svg, "icon_set": prefix}

    except Exception as e:
        logger.warning("Failed for %r in %r: %s", keyword, icon_set, e)
        return None


def _fallback_icon(item: dict) -> dict:
    """Return a clean star outline as final fallback."""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"'
        ' fill="none" stroke="currentColor" stroke-width="1.5"'
        ' stroke-linecap="round" stroke-linejoin="round">'
        '<path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/>'
        '</svg>'
    )
    return {
        "label": item.get("label", ""),
        "icon": "star",
        "benefit": item.get("benefit", ""),
        "svg": svg,
        "icon_set": "fallback",
    }
