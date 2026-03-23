def build_faq_prompt(context: dict) -> tuple[str, str]:
    """Prompt FAQ — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"faq": {"title": str, "items": [{"question": str, "answer": str}]}}
    """

    system = """Tu es un expert en service client e-commerce. Tu crees des FAQ pertinentes et detaillees.
Les reponses utilisent du HTML richtext (<p>, <strong>).
Les questions sont du texte simple, sans HTML.
Tu reponds UNIQUEMENT en JSON valide, sans texte autour.

REGLE LONGUEUR QUESTIONS (OBLIGATOIRE) : Chaque question doit etre COURTE — maximum 8 mots. Exemples corrects : "Ca marche vraiment ?", "Combien de temps pour voir des resultats ?", "C'est sans danger ?", "Livraison rapide ?". INTERDIT de faire des questions longues ou complexes.

REGLE GRAS OBLIGATOIRE : Dans chaque reponse HTML, tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-a-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte. Chaque reponse doit contenir au moins deux <strong>."""

    products = ", ".join(context["product_names"])
    product = context["product_names"][0] if context["product_names"] else "Produit"

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN."
    elif lang.lower().startswith("fr"):
        lang_note = "Genere TOUS les textes en FRANCAIS."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Do NOT write any French. Every single word must be in that language."

    marketing = context.get("marketing_angles", "").strip()
    marketing_note = f"\nAngles marketing prioritaires (intègre-les dans les questions ET les réponses) :\n{marketing}" if marketing else ""

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{lang_note}
{marketing_note}

Genere 5 questions frequentes et leurs reponses pour ce produit.
RAPPEL CRITIQUE : chaque question = 8 mots MAXIMUM. Questions courtes et directes comme un vrai client les poserait.
{f"Les angles marketing ci-dessus DOIVENT transparaitre dans au moins 3 questions et leurs reponses." if marketing else ""}

Reponds en JSON avec ce schema EXACT :

{{
  "faq": {{
    "title": "Questions Frequentes",
    "items": [
      {{
        "question": "Ca marche vraiment ?",
        "answer": "<p>Reponse detaillee avec <strong>expression d'impact</strong>. Complete et utile avec <strong>mot fort</strong>.</p>"
      }},
      {{
        "question": "Resultats en combien de temps ?",
        "answer": "<p>Reponse HTML detaillee avec <strong>expression percutante</strong>.</p>"
      }},
      {{
        "question": "C'est sans danger pour ma peau ?",
        "answer": "<p>Reponse HTML avec <strong>tournure forte</strong>.</p>"
      }},
      {{
        "question": "Comment l'utiliser ?",
        "answer": "<p>Reponse HTML avec <strong>verbe d'action</strong>.</p>"
      }},
      {{
        "question": "Livraison et retours ?",
        "answer": "<p>Reponse HTML avec <strong>mot d'impact</strong>.</p>"
      }}
    ]
  }}
}}

CONTRAINTES :
- Exactement 5 items dans faq.items
- Questions : texte simple, PAS de HTML, 8 mots MAXIMUM chacune
- Reponses : HTML avec <p> et <strong> — au moins deux <strong> par reponse
- Specifique au produit {product}"""

    return system, user
