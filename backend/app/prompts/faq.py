def build_faq_prompt(context: dict) -> tuple[str, str]:
    """Prompt FAQ — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"faq": {"title": str, "items": [{"question": str, "answer": str}]}}
    """

    system = """Tu es un expert en service client e-commerce. Tu crees des FAQ pertinentes et detaillees.
Les reponses utilisent du HTML richtext (<p>, <strong>).
Les questions sont du texte simple, sans HTML.
Tu reponds UNIQUEMENT en JSON valide, sans texte autour.

REGLE GRAS OBLIGATOIRE : Dans chaque reponse HTML, tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-a-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte. Chaque reponse doit contenir au moins deux <strong>."""

    products = ", ".join(context["product_names"])
    product = context["product_names"][0] if context["product_names"] else "Produit"

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN."
    else:
        lang_note = "Genere TOUS les textes en FRANCAIS."

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{lang_note}

Genere 5 questions frequentes pertinentes et leurs reponses pour ce produit.
Les questions doivent etre precises (vraiment posees par les clients) et les reponses utiles.

Reponds en JSON avec ce schema EXACT :

{{
  "faq": {{
    "title": "Questions Frequentes",
    "items": [
      {{
        "question": "Question 1 precise sur le produit ou son utilisation ?",
        "answer": "<p>Reponse detaillee avec <strong>expression d'impact</strong>. Complete et utile avec <strong>mot fort</strong>.</p>"
      }},
      {{
        "question": "Question 2 sur les resultats ou l'efficacite ?",
        "answer": "<p>Reponse HTML detaillee avec <strong>expression percutante</strong>.</p>"
      }},
      {{
        "question": "Question 3 sur la compatibilite ou les precautions ?",
        "answer": "<p>Reponse HTML avec <strong>tournure forte</strong>.</p>"
      }},
      {{
        "question": "Question 4 sur la frequence d'utilisation ou le mode d'emploi ?",
        "answer": "<p>Reponse HTML avec <strong>verbe d'action</strong>.</p>"
      }},
      {{
        "question": "Question 5 sur les ingredients, la composition ou les certifications ?",
        "answer": "<p>Reponse HTML avec <strong>mot d'impact</strong>.</p>"
      }}
    ]
  }}
}}

CONTRAINTES :
- Exactement 5 items dans faq.items
- Les questions sont du texte simple (pas de HTML)
- Les reponses utilisent les balises HTML (<p>, <strong>) — chaque reponse doit avoir au moins deux <strong>
- Sois specifique au produit {product}"""

    return system, user
