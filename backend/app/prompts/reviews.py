def build_reviews_prompt(context: dict) -> tuple[str, str]:
    """Prompt avis clients — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"reviews": [{"name", "age", "rating", "title", "text", "response"}]} x10
    """

    system = """Tu es un expert en marketing e-commerce. Tu génères des avis clients réalistes et variés.
Les textes des avis et des réponses sont en texte simple (AUCUN HTML).
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés avec une orthographe et une grammaire parfaites dans la langue demandée. Pour le français : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords parfaits. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres."""

    products = ", ".join(context["product_names"])
    gender = context.get("target_gender", "femme")

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation. Use English first names."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß). Use German first names."
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables. Utilise des prénoms français."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Use first names typical for that language/culture. Do NOT write any French text."

    if gender.lower() == "homme":
        gender_note = "Public masculin. Utilise majoritairement des prénoms masculins."
        prenoms_ex = "Thomas P., Nicolas V., Antoine M., Julien R., Maxime D., Pierre B., Romain K., Alexandre T., David N., Florian C."
    elif gender.lower() == "mixte":
        gender_note = "Public mixte. Alterne prénoms masculins et féminins."
        prenoms_ex = "Thomas P., Marie L., Nicolas V., Sophie M., Antoine D., Chloé R., Julien B., Léa T., Maxime K., Emma N."
    else:
        gender_note = "Public féminin. Utilise majoritairement des prénoms féminins."
        prenoms_ex = "Marie P., Sophie L., Chloé M., Léa R., Manon D., Amélie B., Charlotte V., Emma T., Isabelle K., Pauline N."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Les avis doivent :
- Mentionner des détails visuels réels du produit que tu observes dans les images
- Paraître authentiques car ils décrivent le produit que les clients ont reçu
- Varier les références (packaging, produit en main, résultats visuels, etc.)
""" if context.get("has_images") else ""

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{gender_note}
{lang_note}
{image_note}
Génère 10 avis clients authentiques et variés pour ce produit.

Réponds en JSON avec ce schéma EXACT :

{{
  "reviews": [
    {{
      "name": "Prénom N. (format Prénom Initiale.)",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre court de l'avis (texte simple)",
      "text": "Texte de l'avis (2-4 phrases authentiques, texte simple sans HTML)",
      "response": "Réponse chaleureuse de {context['store_name']} (1-2 phrases, texte simple)"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 2",
      "text": "Avis 2 différent (angle différent : efficacité, livraison, facilité...)",
      "response": "Réponse 2"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 3",
      "text": "Avis 3",
      "response": "Réponse 3"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 4",
      "text": "Avis 4",
      "response": "Réponse 4"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 5",
      "text": "Avis 5",
      "response": "Réponse 5"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 4,
      "title": "Titre 6 (rating 4, légèrement moins enthousiaste)",
      "text": "Avis 6 nuancé mais positif",
      "response": "Réponse 6"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 7",
      "text": "Avis 7",
      "response": "Réponse 7"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 8",
      "text": "Avis 8",
      "response": "Réponse 8"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 9",
      "text": "Avis 9",
      "response": "Réponse 9"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 10",
      "text": "Avis 10",
      "response": "Réponse 10"
    }}
  ]
}}

CONTRAINTES :
- Exactement 10 avis dans reviews[]
- Prénoms à utiliser (dans l'ordre) : {prenoms_ex}
- Âges entre 22 et 62 ans
- Les textes (text et response) sont en texte simple, AUCUN HTML
- Chaque avis doit être unique (angle différent : résultats, livraison, facilité, rapport qualité/prix...)
- Les réponses de la boutique sont courtes et chaleureuses (1-2 phrases)"""

    return system, user
