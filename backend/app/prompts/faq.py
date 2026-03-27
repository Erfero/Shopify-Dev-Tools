def build_faq_prompt(context: dict) -> tuple[str, str]:
    """Prompt FAQ — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"faq": {"title": str, "items": [{"question": str, "answer": str}]}}
    """

    system = """Tu es un expert en service client e-commerce. Tu crées des FAQ pertinentes et détaillées.
Les réponses utilisent du HTML richtext (<p>, <strong>).
Les questions sont du texte simple, sans HTML.
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés dans un français parfait et irréprochable : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords grammaticaux parfaits, orthographe sans faute. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres.

RÈGLE LONGUEUR QUESTIONS (OBLIGATOIRE) : Chaque question doit être COURTE et naturelle — entre 5 et 10 mots maximum. Exemples corrects : "Est-ce que ça marche vraiment ?", "Combien de temps pour voir des résultats ?", "C'est sans danger pour la peau ?", "Comment l'utiliser au quotidien ?". INTERDIT de faire des questions trop longues ou complexes.

RÈGLE GRAS OBLIGATOIRE : Dans chaque réponse HTML, tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-à-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte. Chaque réponse doit contenir au moins deux <strong>."""

    products = ", ".join(context["product_names"])
    product = context["product_names"][0] if context["product_names"] else "Produit"

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß)."
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Do NOT write any French."

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{lang_note}

Génère 5 questions fréquentes et leurs réponses pour ce produit.
RAPPEL CRITIQUE : chaque question = 5 à 10 mots. Questions naturelles et directes comme un vrai client les poserait.

Réponds en JSON avec ce schéma EXACT :

{{
  "faq": {{
    "title": "Questions Fréquentes",
    "items": [
      {{
        "question": "Ça marche vraiment ?",
        "answer": "<p>Réponse détaillée avec <strong>expression d'impact</strong>. Complète et utile avec <strong>mot fort</strong>.</p>"
      }},
      {{
        "question": "Résultats en combien de temps ?",
        "answer": "<p>Réponse HTML détaillée avec <strong>expression percutante</strong>.</p>"
      }},
      {{
        "question": "C'est sans danger pour ma peau ?",
        "answer": "<p>Réponse HTML avec <strong>tournure forte</strong>.</p>"
      }},
      {{
        "question": "Comment l'utiliser ?",
        "answer": "<p>Réponse HTML avec <strong>verbe d'action</strong>.</p>"
      }},
      {{
        "question": "Livraison et retours ?",
        "answer": "<p>Réponse HTML avec <strong>mot d'impact</strong>.</p>"
      }}
    ]
  }}
}}

CONTRAINTES :
- Exactement 5 items dans faq.items
- Questions : texte simple, PAS de HTML, entre 5 et 10 mots chacune
- Réponses : HTML avec <p> et <strong> — au moins deux <strong> par réponse
- Spécifique au produit {product}"""

    return system, user
