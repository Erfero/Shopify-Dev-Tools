def build_story_page_prompt(context: dict) -> tuple[str, str]:
    """Prompt page Notre Histoire — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"page_heading", "page_subheading", "timeline_events": [{year, heading, text}]} x5
    """

    system = """Tu es un expert en storytelling de marque et en copywriting e-commerce.
Tu crees des histoires de marque engageantes et authentiques.
Les textes des evenements timeline sont en texte simple (pas de HTML).
Tu reponds UNIQUEMENT en JSON valide, sans texte autour."""

    products = ", ".join(context["product_names"])

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN."
    elif lang.lower().startswith("fr"):
        lang_note = "Genere TOUS les textes en FRANCAIS."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Do NOT write any French. Every single word must be in that language."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Utilise ce que tu vois pour :
- Ancrer l'histoire dans la realite du produit (son design, son style, sa qualite visible)
- Raconter comment ce produit specifique a ete concu et developpe
""" if context.get("has_images") else ""

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{lang_note}
{image_note}
Cree une page "Notre Histoire" avec une timeline de 5 evenements cles.
L'histoire doit raconter la naissance de la marque, ses defis, ses succes et sa vision.

Reponds en JSON avec ce schema EXACT :

{{
  "page_heading": "L'Histoire de {context['store_name']} (texte simple)",
  "page_subheading": "Sous-titre inspirant (texte simple, 1-2 phrases)",
  "timeline_events": [
    {{
      "year": "2019",
      "heading": "Titre evenement 1 (texte simple, ex: La naissance d'une idee)",
      "text": "2 phrases courtes max. Raconte le debut de l'aventure."
    }},
    {{
      "year": "2020",
      "heading": "Titre evenement 2 (texte simple)",
      "text": "2 phrases courtes max. Premier succes ou pivot important."
    }},
    {{
      "year": "2021",
      "heading": "Titre evenement 3 (texte simple)",
      "text": "2 phrases courtes max. Croissance ou innovation cle."
    }},
    {{
      "year": "2022",
      "heading": "Titre evenement 4 (texte simple)",
      "text": "2 phrases courtes max. Expansion ou reconnaissance."
    }},
    {{
      "year": "2023",
      "heading": "Titre evenement 5 (texte simple)",
      "text": "2 phrases courtes max. Vision actuelle et engagement."
    }}
  ]
}}

CONTRAINTES :
- Exactement 5 evenements dans timeline_events
- Les textes (heading et text) sont du texte simple (AUCUN HTML)
- Chaque "text" : MAX 2 phrases courtes (10-15 mots chacune)
- Raconte une vraie histoire : passion, defis, succes, mission
- Sois emotionnel et authentique"""

    return system, user
