"""Product icon finder — maps product benefits to colorful flat SVG icons via Iconify."""
import asyncio
import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# Icon sets to try, in order of preference (clean stroke/outline icons — black on white)
_ICON_SETS = ["tabler", "lucide", "phosphor"]

_SYSTEM = (
    "Tu es un expert en design iconographique et en marketing e-commerce. "
    "Tu génères des labels, bénéfices et mots-clés d'icônes pour des avantages produit."
)

_PROMPT = """Produit : {name}
Description / bénéfices : {desc}
Angles marketing : {angles}

Génère exactement {n} icônes représentant les principaux avantages et bénéfices de ce produit.
Pour chaque icône, fournis :
- label : titre court de l'avantage (2-4 mots, en français)
- benefit : description du bénéfice (une phrase complète, en français)
- keyword : mot-clé EN ANGLAIS simple pour chercher l'icône (1-2 mots, ex: "water", "shield", "leaf", "heart", "sun", "star", "clock", "gift", "rose", "spa", "drop", "smile", "trophy", "protect", "organic")

Retourne UNIQUEMENT ce JSON valide (pas de markdown, pas de texte autour) :
[
  {{"label": "Hydratation intense", "benefit": "Hydrate la peau en profondeur pendant 24h", "keyword": "drop"}},
  {{"label": "Protection solaire", "benefit": "Protège des rayons UV toute la journée", "keyword": "protect"}}
]"""


async def find_product_icons(
    product_name: str,
    product_description: str,
    marketing_angles: str = "",
    n: int = 5,
) -> list[dict]:
    """Generate n benefit icons with colorful flat SVGs from Iconify."""
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
            _fetch_flat_icon(client, item)
            for item in icon_data[:n]
        ])

    return list(results)


async def _fetch_flat_icon(client: httpx.AsyncClient, item: dict) -> dict:
    """Search Iconify for a flat colorful icon, try multiple sets."""
    keyword = item.get("keyword", "star")
    label = item.get("label", "")
    benefit = item.get("benefit", "")

    for icon_set in _ICON_SETS:
        result = await _try_search(client, keyword, icon_set, label, benefit)
        if result:
            return result

        # Try first word only if keyword has multiple words
        if " " in keyword:
            result = await _try_search(client, keyword.split()[0], icon_set, label, benefit)
            if result:
                return result

    # Last resort: generic search across all stroke-based sets
    try:
        r = await client.get(
            "https://api.iconify.design/search",
            params={"query": keyword, "limit": 1, "prefixes": ",".join(_ICON_SETS)},
        )
        if r.status_code == 200:
            icons = r.json().get("icons", [])
            if icons:
                svg = await _fetch_svg(client, icons[0])
                if svg:
                    prefix, name = icons[0].split(":", 1)
                    return {"label": label, "icon": name, "benefit": benefit, "svg": svg, "icon_set": prefix}
    except Exception as e:
        logger.warning("Generic search failed for %r: %s", keyword, e)

    return _fallback_icon(item)


async def _try_search(
    client: httpx.AsyncClient, keyword: str, icon_set: str, label: str, benefit: str
) -> dict | None:
    try:
        r = await client.get(
            "https://api.iconify.design/search",
            params={"query": keyword, "limit": 3, "prefixes": icon_set},
        )
        if r.status_code != 200:
            return None
        icons = r.json().get("icons", [])
        if not icons:
            return None

        icon_id = icons[0]
        svg = await _fetch_svg(client, icon_id)
        if not svg:
            return None

        prefix, name = icon_id.split(":", 1)
        return {"label": label, "icon": name, "benefit": benefit, "svg": svg, "icon_set": prefix}
    except Exception as e:
        logger.warning("Search failed for %r in %r: %s", keyword, icon_set, e)
        return None


async def _fetch_svg(client: httpx.AsyncClient, icon_id: str) -> str:
    """Fetch SVG for an icon_id like 'flat-color-icons:drop'."""
    try:
        prefix, name = icon_id.split(":", 1)
        r = await client.get(
            f"https://api.iconify.design/{prefix}/{name}.svg",
            follow_redirects=True,
        )
        if r.status_code != 200:
            return ""
        svg = r.text
        svg = re.sub(r'width="\d+"', 'width="100%"', svg)
        svg = re.sub(r'height="\d+"', 'height="100%"', svg)
        return svg
    except Exception:
        return ""


def _fallback_icon(item: dict) -> dict:
    """Return a clean black circle outline as fallback."""
    svg = (
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="100%" height="100%"'
        ' fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">'
        '<circle cx="12" cy="12" r="9"/>'
        '<path d="M12 8v4M12 16h.01"/>'
        '</svg>'
    )
    return {
        "label": item.get("label", ""),
        "icon": "circle",
        "benefit": item.get("benefit", ""),
        "svg": svg,
        "icon_set": "fallback",
    }
