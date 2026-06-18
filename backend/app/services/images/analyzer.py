"""
Product image analyzer — combines vision AI + product text info to generate
highly specific search queries covering all relevant image types.
"""
import base64
import json
import re

import httpx

from app.config import settings


_SYSTEM = (
    "Tu es un expert en marketing e-commerce, en photographie lifestyle et en recherche d'images. "
    "Tu génères des requêtes de recherche ultra-spécifiques pour trouver exactement les photos "
    "qui correspondent à un produit, son utilisation réelle, ses résultats et son contexte lifestyle."
)

_USER_TMPL = """Produit : {name}
Description / bénéfices : {desc}
Angles marketing : {angles}

Analyse l'image de ce produit et génère des requêtes de recherche très spécifiques.
Les requêtes doivent couvrir TOUS ces types de photos :
1. Personne utilisant le produit en situation réelle
2. Résultats visibles avant / après utilisation
3. Personne tenant / présentant / montrant le produit
4. Produit dans son contexte d'utilisation (salle de bain, cuisine, sport, extérieur...)
5. Bénéfices visibles sur une personne (peau lumineuse, muscles, énergie, intérieur propre...)

Retourne UNIQUEMENT ce JSON valide (pas de markdown, pas d'explication) :
{{
  "visual_description": "description détaillée du produit : couleur, texture, forme, conditionnement",
  "product_category": "catégorie précise (ex: soin visage anti-âge, complément sportif, diffuseur huiles essentielles)",
  "target_audience": "public cible précis (ex: femmes 30-50 ans, sportifs hommes 20-40 ans)",
  "usage_context": "contexte précis (ex: salle de bain le matin, cuisine quotidienne, gym)",
  "search_queries": [
    "personne utilisant {name_short} en situation réelle — requête anglaise précise avec adjectifs visuels",
    "résultat visible avant après {benefit} — requête anglaise avec résultat concret",
    "femme/homme tenant présentant {name_short} — requête anglaise lifestyle",
    "bénéfice visible {benefit} sur personne — requête anglaise avec résultat visible",
    "contexte lifestyle {context} {name_short} — requête anglaise ambiance",
    "{audience} routine {context} — requête anglaise public cible + contexte",
    "close up {product_visual} product person hand — requête anglaise détail produit + main",
    "{benefit} transformation woman/man result — requête anglaise résultat transformation"
  ],
  "dalle_prompt": "Prompt DALL-E 3 : photo lifestyle réaliste de [description précise] montrant une personne utilisant {name_short}, éclairage naturel, haute résolution, contexte {context}"
}}"""


async def analyze_product_image(
    image_bytes: bytes,
    content_type: str,
    product_name: str,
    product_description: str,
    marketing_angles: str = "",
) -> dict:
    """
    Analyze product image + text info → highly specific search queries.
    Uses: visual analysis + product name + description + marketing angles.
    """
    b64 = base64.b64encode(image_bytes).decode()
    data_url = f"data:{content_type};base64,{b64}"

    # Build a short name for query placeholders
    name_short = product_name.split()[0] if product_name else "product"

    prompt = _USER_TMPL.format(
        name=product_name,
        name_short=name_short,
        desc=product_description or "Non renseignée",
        angles=marketing_angles or "Non renseignés",
        # These placeholders will be filled by the AI
        benefit="{benefit}",
        context="{context}",
        audience="{audience}",
        product_visual="{product_visual}",
    )

    async with httpx.AsyncClient(timeout=60) as client:
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
                "max_tokens": 1500,
                "temperature": 0.3,
            },
        )
        resp.raise_for_status()

    raw = resp.json()["choices"][0]["message"]["content"].strip()
    raw = re.sub(r"^```(?:json)?\s*", "", raw)
    raw = re.sub(r"\s*```$", "", raw.strip())

    result = json.loads(raw)

    # Always add product-name-based queries to boost specificity
    extra_queries = _build_extra_queries(product_name, product_description, marketing_angles)
    existing = result.get("search_queries", [])
    # Merge, deduplicate, keep up to 10
    all_queries = existing + [q for q in extra_queries if q not in existing]
    result["search_queries"] = all_queries[:10]

    return result


def _build_extra_queries(name: str, description: str, angles: str) -> list[str]:
    """
    Build additional keyword-based queries from product text data.
    These supplement the vision-based queries for broader coverage.
    """
    queries = []
    words = name.lower().split() if name else []

    # Extract key terms from description
    desc_lower = (description + " " + angles).lower()

    # Detect product type signals and build targeted queries
    signals = {
        "skincare": any(w in desc_lower for w in ["peau", "crème", "sérum", "skin", "visage", "face", "teint"]),
        "haircare": any(w in desc_lower for w in ["cheveux", "hair", "cuir chevelu", "scalp"]),
        "supplement": any(w in desc_lower for w in ["capsule", "gélule", "complément", "supplement", "vitamin"]),
        "fitness": any(w in desc_lower for w in ["sport", "muscu", "gym", "fitness", "protein", "énergie"]),
        "home": any(w in desc_lower for w in ["maison", "intérieur", "nettoy", "home", "diffuseur", "clean"]),
        "beauty": any(w in desc_lower for w in ["beauté", "maquillage", "beauty", "makeup", "cosmétique"]),
        "weight": any(w in desc_lower for w in ["minceur", "poids", "weight", "slimming", "ventre"]),
        "anti_age": any(w in desc_lower for w in ["anti-âge", "anti age", "rides", "wrinkle", "jeunesse", "youth"]),
    }

    if signals["skincare"] or signals["anti_age"]:
        queries += [
            "woman glowing skin before after skincare routine",
            "woman applying face serum bathroom morning routine",
            "healthy radiant skin close up woman portrait",
        ]
    if signals["haircare"]:
        queries += [
            "woman beautiful shiny hair before after treatment",
            "woman applying hair product routine selfie",
        ]
    if signals["supplement"]:
        queries += [
            "woman man holding supplement capsule bottle hand",
            "healthy lifestyle supplements morning routine table",
            "person energetic fit taking daily vitamins",
        ]
    if signals["fitness"]:
        queries += [
            "fit person gym workout supplement protein shake",
            "athletic body transformation before after fitness",
            "woman man exercise sport healthy lifestyle",
        ]
    if signals["home"]:
        queries += [
            "clean modern home interior lifestyle product",
            "woman using home product clean fresh interior",
        ]
    if signals["beauty"]:
        queries += [
            "woman beauty routine skincare makeup lifestyle",
            "woman confident glowing natural beauty portrait",
        ]
    if signals["weight"]:
        queries += [
            "woman slim body transformation before after",
            "healthy weight loss lifestyle woman confident",
        ]

    # Generic fallbacks based on product name keywords
    if not any(signals.values()) and words:
        product_key = " ".join(words[:2])
        queries += [
            f"woman using {product_key} lifestyle product",
            f"person holding {product_key} beauty product",
            f"{product_key} before after results person",
        ]

    return queries
