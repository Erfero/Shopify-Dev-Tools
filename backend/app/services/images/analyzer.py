"""
Product image analyzer — uses vision model to extract visual attributes and
generate optimized search queries for Pexels/Unsplash.
"""
import base64
import json
import re

import httpx

from app.config import settings


_SYSTEM = (
    "Tu es un expert en marketing e-commerce et en recherche d'images lifestyle. "
    "Analyse une image produit et génère des requêtes de recherche précises pour trouver "
    "des photos réelles montrant ce produit en utilisation ou ses bénéfices."
)

_USER_TMPL = """Produit : {name}
Description : {desc}

Analyse cette image produit. Retourne UNIQUEMENT ce JSON valide (pas de markdown) :
{{
  "visual_description": "description détaillée couleur/texture/forme/matière du produit",
  "product_category": "catégorie (ex: soin visage, complément alimentaire, décoration intérieure)",
  "target_audience": "public cible précis (ex: femmes 25-45 ans, sportifs, familles)",
  "usage_context": "où et comment utilisé (ex: salle de bain le matin, cuisine, sport extérieur)",
  "search_queries": [
    "query anglais lifestyle personne utilisant le produit",
    "query anglais résultat visible sur personne",
    "query anglais produit en situation réelle",
    "query anglais bénéfice principal montré visuellement",
    "query anglais ambiance contexte utilisation"
  ],
  "dalle_prompt": "prompt DALL-E 3 détaillé pour générer une photo lifestyle du produit, photorealistic, natural lighting, high resolution"
}}"""


async def analyze_product_image(
    image_bytes: bytes,
    content_type: str,
    product_name: str,
    product_description: str,
) -> dict:
    """Analyze product image → visual description + search queries + DALL-E prompt."""
    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"
    prompt = _USER_TMPL.format(name=product_name, desc=product_description or "")

    async with httpx.AsyncClient(timeout=45) as client:
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
                    {
                        "role": "user",
                        "content": [
                            {"type": "image_url", "image_url": {"url": data_url}},
                            {"type": "text", "text": prompt},
                        ],
                    },
                ],
                "max_tokens": 1200,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    # Strip markdown code fences if present
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())
    return json.loads(raw)
