def build_story_page_prompt(context: dict) -> tuple[str, str]:
    """Prompt page Notre Histoire — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"page_heading", "page_subheading", "timeline_events": [{year, heading, text}]} x5
    """

    system = """Tu es un expert en storytelling de marque et en copywriting e-commerce.
Tu crées des histoires de marque engageantes et authentiques.
Les textes des événements timeline sont en texte simple (pas de HTML).
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés dans un français parfait et irréprochable : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords grammaticaux parfaits, orthographe sans faute. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres."""

    products = ", ".join(context["product_names"])

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß)."
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Do NOT write any French."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Utilise ce que tu vois pour :
- Ancrer l'histoire dans la réalité du produit (son design, son style, sa qualité visible)
- Raconter comment ce produit spécifique a été conçu et développé
""" if context.get("has_images") else ""

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{lang_note}
{image_note}
Crée une page "Notre Histoire" avec une timeline de 5 événements clés.
L'histoire doit raconter la naissance de la marque, ses défis, ses succès et sa vision.

Réponds en JSON avec ce schéma EXACT :

{{
  "page_heading": "L'Histoire de {context['store_name']} (texte simple)",
  "page_subheading": "Sous-titre inspirant (texte simple, 1-2 phrases)",
  "timeline_events": [
    {{
      "year": "2019",
      "heading": "Titre événement 1 (texte simple, ex: La naissance d'une idée)",
      "text": "2 phrases courtes max. Raconte le début de l'aventure."
    }},
    {{
      "year": "2020",
      "heading": "Titre événement 2 (texte simple)",
      "text": "2 phrases courtes max. Premier succès ou pivot important."
    }},
    {{
      "year": "2021",
      "heading": "Titre événement 3 (texte simple)",
      "text": "2 phrases courtes max. Croissance ou innovation clé."
    }},
    {{
      "year": "2022",
      "heading": "Titre événement 4 (texte simple)",
      "text": "2 phrases courtes max. Expansion ou reconnaissance."
    }},
    {{
      "year": "2023",
      "heading": "Titre événement 5 (texte simple)",
      "text": "2 phrases courtes max. Vision actuelle et engagement."
    }}
  ]
}}

CONTRAINTES :
- Exactement 5 événements dans timeline_events
- Les textes (heading et text) sont du texte simple (AUCUN HTML)
- Chaque "text" : MAX 2 phrases courtes (10-15 mots chacune)
- Raconte une vraie histoire : passion, défis, succès, mission
- Sois émotionnel et authentique"""

    return system, user
