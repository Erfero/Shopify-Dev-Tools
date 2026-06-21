"""Product icon finder — returns Phosphor icon names for frontend rendering."""
import json
import logging
import re

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Curated Phosphor icon names relevant to product benefits ─────────────────
# These are validated Phosphor v2 component names (phosphoricons.com)
_PHOSPHOR_ICONS = [
    # Hydration / water / moisture
    "Drop", "DropHalf",
    # Radiance / sun / UV / brightness
    "Sun", "SunDim", "SunHorizon",
    # Protection / security
    "Shield", "ShieldCheck", "ShieldStar",
    # Natural / organic / botanical
    "Leaf", "Flower", "FlowerLotus", "Plant",
    # Care / love / wellness
    "Heart", "HeartStraight", "HandHeart",
    # Quality / excellence / premium / award
    "Star", "Medal", "Crown", "Diamond", "Trophy",
    # Time / fast / quick
    "Clock", "Timer", "Hourglass",
    # Gift / bonus / value
    "Gift",
    # Night / sleep / rest
    "Moon", "MoonStars",
    # Energy / warmth / power / boost
    "Fire", "Lightning", "Barbell",
    # Light / gentle / delicate / airy
    "Feather", "Wind",
    # Freshness / coolness
    "Snowflake", "Waves",
    # Verified / certified / approved
    "CheckCircle", "SealCheck",
    # Results / growth / effectiveness
    "TrendUp",
    # Glow / luminosity / shine / sparkle
    "Sparkle",
    # Eye / visible / appearance
    "Eye",
    # Happy / comfort / satisfaction
    "Smiley",
    # Science / formula / tested / clinical
    "Flask", "Atom", "TestTube",
    # Health / vitality
    "Heartbeat", "FirstAid",
    # Eco / sustainable / recycle
    "Recycle",
    # Security / lock / safe
    "Lock",
    # Balance / harmony / scales
    "Scales",
    # Precision / focus / target
    "Target", "MagnifyingGlass",
    # Multi-benefit / layers
    "Layers",
    # Beauty / fragrance
    "Rose",
    # Vitamins / nutrition / supplements
    "Pill",
]

_AVAILABLE = ", ".join(_PHOSPHOR_ICONS)

# ── AI prompt ────────────────────────────────────────────────────────────────

_SYSTEM = (
    "Tu es un expert en marketing e-commerce et en design d'icônes. "
    "Tu associes les avantages produit aux icônes les plus visuellement pertinentes."
)

_PROMPT = """Produit : {name}
Description / bénéfices : {desc}
Angles marketing : {angles}

Génère exactement {n} icônes représentant les principaux avantages de ce produit.
Pour chaque icône :
- label : titre court en français (2-4 mots)
- benefit : description du bénéfice en français (une phrase percutante)
- icon : choisis l'icône la PLUS PERTINENTE visuellement dans cette liste EXACTE :
{icons}

Règles importantes :
- Choisis des icônes DIFFÉRENTES pour chaque avantage
- L'icône doit représenter visuellement le bénéfice (ex: Drop = hydratation, Shield = protection)
- Retourne UNIQUEMENT ce JSON valide, sans markdown :

[
  {{"label": "Hydratation profonde", "benefit": "Nourrit et hydrate la peau en profondeur", "icon": "Drop"}},
  {{"label": "Protection UV", "benefit": "Protège efficacement des rayons UV nocifs", "icon": "ShieldCheck"}}
]"""


async def find_product_icons(
    product_name: str,
    product_description: str,
    marketing_angles: str = "",
    n: int = 6,
) -> list[dict]:
    """Generate n benefit icons using Phosphor icon names."""
    prompt = _PROMPT.format(
        name=product_name,
        desc=product_description or "Non renseignée",
        angles=marketing_angles or "Non renseignés",
        n=n,
        icons=_AVAILABLE,
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

    results = []
    for item in icon_data[:n]:
        icon_name = item.get("icon", "Star")
        if icon_name not in _PHOSPHOR_ICONS:
            icon_name = "Star"
        results.append({
            "label": item.get("label", ""),
            "icon": icon_name,
            "benefit": item.get("benefit", ""),
            "svg": "",
        })

    return results
