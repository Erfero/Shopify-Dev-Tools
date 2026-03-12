def build_reviews_prompt(context: dict) -> tuple[str, str]:
    """Prompt avis clients — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"reviews": [{"name", "age", "rating", "title", "text", "response"}]} x10
    """

    system = """Tu es un expert en marketing e-commerce. Tu generes des avis clients realistes et varies.
Les textes des avis et des reponses sont en texte simple (AUCUN HTML).
Tu reponds UNIQUEMENT en JSON valide, sans texte autour."""

    products = ", ".join(context["product_names"])
    gender = context.get("target_gender", "femme")

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use English first names."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use German first names."
    else:
        lang_note = "Genere TOUS les textes en FRANCAIS. Utilise des prenoms francais."

    if gender.lower() == "homme":
        gender_note = "Public masculin. Utilise majoritairement des prenoms masculins."
        prenoms_ex = "Thomas P., Nicolas V., Antoine M., Julien R., Maxime D., Pierre B., Romain K., Alexandre T., David N., Florian C."
    elif gender.lower() == "mixte":
        gender_note = "Public mixte. Alterne prenoms masculins et feminins."
        prenoms_ex = "Thomas P., Marie L., Nicolas V., Sophie M., Antoine D., Chloe R., Julien B., Lea T., Maxime K., Emma N."
    else:
        gender_note = "Public feminin. Utilise majoritairement des prenoms feminins."
        prenoms_ex = "Marie P., Sophie L., Chloe M., Lea R., Manon D., Amelie B., Charlotte V., Emma T., Isabelle K., Pauline N."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Les avis doivent :
- Mentionner des details visuels reels du produit que tu observes dans les images
- Paraitre authentiques car ils decrivent le produit que les clients ont recu
- Varier les references (packaging, produit en main, resultats visuels, etc.)
""" if context.get("has_images") else ""

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{gender_note}
{lang_note}
{image_note}
Genere 10 avis clients authentiques et varies pour ce produit.

Reponds en JSON avec ce schema EXACT :

{{
  "reviews": [
    {{
      "name": "Prenom N. (format Prenom Initiale.)",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre court de l'avis (texte simple)",
      "text": "Texte de l'avis (2-4 phrases authentiques, texte simple sans HTML)",
      "response": "Reponse chaleureuse de {context['store_name']} (1-2 phrases, texte simple)"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 2",
      "text": "Avis 2 different (angle different : efficacite, livraison, facilite...)",
      "response": "Reponse 2"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 3",
      "text": "Avis 3",
      "response": "Reponse 3"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 4",
      "text": "Avis 4",
      "response": "Reponse 4"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 5",
      "text": "Avis 5",
      "response": "Reponse 5"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 4,
      "title": "Titre 6 (rating 4, legerement moins enthousiaste)",
      "text": "Avis 6 nuance mais positif",
      "response": "Reponse 6"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 7",
      "text": "Avis 7",
      "response": "Reponse 7"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 8",
      "text": "Avis 8",
      "response": "Reponse 8"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 9",
      "text": "Avis 9",
      "response": "Reponse 9"
    }},
    {{
      "name": "Prenom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 10",
      "text": "Avis 10",
      "response": "Reponse 10"
    }}
  ]
}}

CONTRAINTES :
- Exactement 10 avis dans reviews[]
- Prenoms a utiliser (dans l'ordre) : {prenoms_ex}
- Ages entre 22 et 62 ans
- Les textes (text et response) sont en texte simple, AUCUN HTML
- Chaque avis doit etre unique (angle different : resultats, livraison, facilite, rapport qualite/prix...)
- Les reponses de la boutique sont courtes et chaleureuses (1-2 phrases)"""

    return system, user
