import httpx
import json
import base64
from typing import List, Dict, Optional

from app.config import settings

OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"

GENDER_CONFIG = {
    "femmes": {
        "description": "women (target audience is female)",
        "names_instruction": "Use ONLY French female first names (e.g., Marie, Sophie, Camille, Emma, Léa, Inès, Chloé, Manon, Laura, Jade, Clara, Lucie, Anaïs, Pauline, Alice, etc.)",
    },
    "hommes": {
        "description": "men (target audience is male)",
        "names_instruction": "Use ONLY French male first names (e.g., Thomas, Lucas, Maxime, Hugo, Pierre, Antoine, Nicolas, Julien, Alexandre, Baptiste, etc.)",
    },
    "mixte": {
        "description": "both men and women",
        "names_instruction": "Use a MIX of French male and female first names alternating between genders",
    },
}

MOCK_REVIEWS = [
    {
        "author": "Marie P. - 28 ans",
        "review": "Je suis absolument ravie de ce produit ! La qualité est vraiment exceptionnelle et je ne m'attendais pas à des résultats aussi impressionnants en si peu de temps. La livraison a été ultra rapide, j'ai reçu ma commande en 2 jours seulement, c'est vraiment top.",
        "reply": "Bonjour Marie, merci infiniment pour ce magnifique retour ! Nous sommes ravis que le produit vous donne entière satisfaction.",
    },
    {
        "author": "Sophie L. - 34 ans",
        "review": "Un produit de qualité exceptionnelle que je recommande vivement à toutes mes amies. Les résultats sont visibles dès la première utilisation et ça change vraiment la vie au quotidien. La marque est vraiment sérieuse et le service client est au top.",
        "reply": "Chère Sophie, votre retour nous touche profondément ! N'hésitez pas à revenir vers nous si vous avez besoin.",
    },
]


async def analyze_product_images(images_data: List[bytes], images_mime: List[str]) -> str:
    """
    Send product photos to a vision model and get back a detailed
    description that will enrich the review generation prompt.
    """
    if not images_data:
        return ""

    if settings.USE_MOCK:
        return "Le produit est de haute qualité avec une belle finition. Il se distingue par son design soigné et ses matériaux premium."

    content = [
        {
            "type": "text",
            "text": (
                "You are analyzing product photos for an e-commerce store. "
                "Look carefully at each image and provide a detailed, precise description of:\n"
                "1. What the product looks like (shape, color, design, size impression)\n"
                "2. Materials and build quality visible in the photos\n"
                "3. Key features and details you can observe\n"
                "4. The overall aesthetic and style of the product\n"
                "5. Any text, branding, or labels visible\n\n"
                "Write 3-5 sentences in English. Be specific and factual — this description will be used "
                "to generate authentic customer reviews, so accuracy is critical."
            ),
        }
    ]

    for i, (img_bytes, mime) in enumerate(zip(images_data, images_mime)):
        b64 = base64.b64encode(img_bytes).decode("utf-8")
        content.append({
            "type": "image_url",
            "image_url": {
                "url": f"data:{mime};base64,{b64}"
            },
        })

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.frontend_url,
        "X-Title": "Loox Review Generator",
    }

    payload = {
        "model": settings.AI_VISION_MODEL,
        "messages": [{"role": "user", "content": content}],
        "temperature": 0.3,
        "max_tokens": 512,
    }

    async with httpx.AsyncClient(timeout=60.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()
        data = response.json()
        return data["choices"][0]["message"]["content"].strip()


def build_prompt(
    product_name: str,
    brand_name: str,
    product_description: str,
    target_gender: str,
    language: str,
    batch_size: int,
    batch_number: int,
    existing_authors: List[str],
    visual_analysis: Optional[str] = None,
) -> str:
    gender = GENDER_CONFIG.get(target_gender, GENDER_CONFIG["femmes"])
    avoid_names = ""
    if existing_authors:
        sample = existing_authors[-15:]
        avoid_names = f"\n\nIMPORTANT - Do NOT reuse these names already used: {', '.join(sample)}"

    visual_section = ""
    if visual_analysis:
        visual_section = f"\n- Visual analysis from product photos: {visual_analysis}"

    is_mixte = target_gender == "mixte"
    gender_field_rule = ""
    json_example_field = ""
    if is_mixte:
        gender_field_rule = (
            '\n6. GENDER FIELD: Since the audience is mixed, each review object MUST include a "gender" field: '
            '"F" for female reviewers, "M" for male reviewers. '
            'Strictly alternate starting with F: F, M, F, M, F, M, ...'
        )
        json_example_field = ', "gender": "F"'

    return f"""Generate exactly {batch_size} authentic customer reviews for this product. This is batch number {batch_number}.

PRODUCT DETAILS:
- Product name: {product_name}
- Brand/Store: {brand_name}
- Product description: {product_description}{visual_section}
- Target audience: {gender['description']}

STRICT RULES:
1. LANGUAGE & QUALITY: Every single word (reviews AND replies) MUST be written in {language}. No exceptions. Use perfect grammar, correct spelling with ALL required accents and special characters (for French: é, è, ê, à, â, ç, ù, û, î, ô, œ — NEVER omit them; for German: ä, ö, ü, ß and capitalized nouns). Native-level fluency, zero errors.
2. AUTHOR NAMES: {gender['names_instruction']}. Format: "Prénom L. - XX ans" (e.g., "Marie P. - 28 ans"). Age between 18 and 52. NEVER repeat the same name.
3. REVIEWS: Each review MUST be minimum 3 sentences. Make them varied, natural and SPECIFIC to this product. Mention product details from the description. Focus on different themes:
   - Product quality and appearance (reference specific visual details)
   - Fast/quick delivery (mention days received)
   - Visible results and effectiveness
   - Recommending to friends/family
   - Personal story or situation where they used the product
   - Price/value for money
   - How the product looks/feels in real life
4. REPLIES: Owner reply per review, MAXIMUM 2 sentences. Warm, grateful, professional. Address reviewer by first name. Written in {language}.
5. DIVERSITY: Each review must be completely unique in style and content. Vary sentence structure, length, and vocabulary.{gender_field_rule}{avoid_names}

Return ONLY a valid JSON array with exactly {batch_size} objects. No markdown, no code blocks, no explanation:
[
  {{"author": "Prénom L. - XX ans"{json_example_field}, "review": "Review text here...", "reply": "Owner reply here..."}},
  ...
]"""


async def generate_review_batch(
    product_name: str,
    brand_name: str,
    product_description: str,
    target_gender: str,
    language: str,
    batch_size: int,
    batch_number: int,
    existing_authors: List[str],
    visual_analysis: Optional[str] = None,
) -> List[Dict]:
    if settings.USE_MOCK:
        result = []
        for i in range(batch_size):
            idx = (batch_number * batch_size + i) % len(MOCK_REVIEWS)
            mock = MOCK_REVIEWS[idx].copy()
            result.append(mock)
        return result

    prompt = build_prompt(
        product_name,
        brand_name,
        product_description,
        target_gender,
        language,
        batch_size,
        batch_number,
        existing_authors,
        visual_analysis,
    )

    headers = {
        "Authorization": f"Bearer {settings.OPENROUTER_API_KEY}",
        "Content-Type": "application/json",
        "HTTP-Referer": settings.frontend_url,
        "X-Title": "Loox Review Generator",
    }

    payload = {
        "model": settings.model,
        "messages": [
            {
                "role": "system",
                "content": (
                    "You are an expert at generating authentic, diverse e-commerce customer reviews. "
                    "You always return valid JSON arrays only, with no extra text or markdown.\n\n"
                    "ABSOLUTE LANGUAGE QUALITY RULE: Every single word you generate must be written "
                    "in perfect, native-level language as specified in the user prompt. "
                    "For French: use all required accents (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ) — "
                    "NEVER omit accents. Perfect grammar, correct conjugation, proper agreements. "
                    "For German: use all umlauts (ä, ö, ü, ß) and capitalize all nouns. "
                    "For any language: zero spelling errors, zero missing special characters. "
                    "This rule is absolute and cannot be overridden."
                ),
            },
            {"role": "user", "content": prompt},
        ],
        "temperature": 0.92,
        "max_tokens": 4096,
    }

    async with httpx.AsyncClient(timeout=120.0) as client:
        response = await client.post(OPENROUTER_URL, headers=headers, json=payload)
        response.raise_for_status()

        data = response.json()
        content = data["choices"][0]["message"]["content"].strip()

        if "```" in content:
            parts = content.split("```")
            for part in parts:
                stripped = part.strip()
                if stripped.startswith("[") or stripped.startswith("json\n["):
                    content = stripped.lstrip("json").strip()
                    break

        reviews = json.loads(content)

        if not isinstance(reviews, list):
            raise ValueError(f"Expected JSON array, got: {type(reviews)}")

        return reviews
