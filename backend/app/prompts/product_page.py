def build_product_page_prompt(context: dict) -> tuple[str, str]:
    """Prompt page produit — schéma identique à mock_generator.py / theme_modifier.py."""

    system = """Tu es un expert en copywriting e-commerce. Tu crees du contenu produit detaille et convaincant.
Les champs "text" richtext utilisent du HTML (<p>, <strong>).
Les headings et short_titles sont du texte simple, sans HTML.
Les textes des mini_reviews sont du texte simple (pas de HTML).
Tu reponds UNIQUEMENT en JSON valide, sans texte autour.

REGLE GRAS OBLIGATOIRE : Dans TOUS les champs HTML (product_description.text, how_it_works.text, adoption.text), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-a-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur. Chaque champ HTML doit contenir plusieurs <strong>.

REGLE LONGUEUR STRICTE : Tous les champs "text" sont COURTS. Maximum 2 phrases par paragraphe, maximum 2 paragraphes. Chaque phrase fait 10-15 mots MAX. PAS de longs textes."""

    products = ", ".join(context["product_names"])
    product = context["product_names"][0] if context["product_names"] else "Produit"
    gender = context.get("target_gender", "femme")
    store = context["store_name"]

    if gender.lower() == "homme":
        plural_label = "hommes"
    elif gender.lower() == "mixte":
        plural_label = "personnes"
    else:
        plural_label = "femmes"

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN."
    else:
        lang_note = "Genere TOUS les textes en FRANCAIS."

    image_note = """
IMPORTANT : Des images du produit sont jointes. C'est CRUCIAL pour cette page :
- Decris le produit en te basant sur ce que tu VOIS (forme, taille, couleur, materiau, design)
- Les caracteristiques et avantages doivent correspondre au produit REEL visible
- Sois precis et concret, pas generique
""" if context.get("has_images") else ""

    user = f"""Boutique : {store}
Produit : {product}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
Public cible : {plural_label}
{lang_note}
{image_note}
Genere les textes de la page produit. Reponds en JSON avec ce schema EXACT :

{{
  "product_benefits": [
    {{"short_title": "Benefice court 1 (texte simple, ~3-4 mots)", "description": "Explication courte (1 phrase, texte simple)"}},
    {{"short_title": "Benefice court 2", "description": "Explication courte"}},
    {{"short_title": "Benefice court 3", "description": "Explication courte"}},
    {{"short_title": "Benefice court 4", "description": "Explication courte"}},
    {{"short_title": "Benefice court 5", "description": "Explication courte"}}
  ],
  "product_description": {{
    "heading": "Description (texte simple)",
    "text": "<p>2 phrases courtes avec <strong>expression d'impact</strong>.</p><p>2 autres phrases courtes avec <strong>mot fort</strong>.</p>"
  }},
  "how_it_works": {{
    "heading": "Comment ca marche ? (texte simple)",
    "text": "<p>2 phrases courtes expliquant le mecanisme avec <strong>mots d'impact</strong>.</p><p>2 phrases courtes sur les benefices.</p>"
  }},
  "adoption": {{
    "heading": "+9860 {plural_label} l'ont adopte (texte simple, personnalise le chiffre avec un nombre realiste)",
    "text": "<p>2 phrases courtes social proof avec <strong>expression percutante</strong>.</p>"
  }},
  "mini_reviews": [
    {{"name": "Prenom N. (coherent avec public {gender})", "age": "XX ans", "text": "Temoignage court : 2 phrases simples sans HTML."}},
    {{"name": "Prenom N.", "age": "XX ans", "text": "Temoignage court different : 2 phrases."}},
    {{"name": "Prenom N.", "age": "XX ans", "text": "Temoignage court different : 2 phrases."}}
  ],
  "product_specs": {{
    "title": "Le [nom-court-du-produit] qu'il vous faut (format OBLIGATOIRE : Le + nom ou categorie courte + qu'il vous faut, ex: Le masque qu'il vous faut, Le serum qu'il vous faut)",
    "items": [
      {{"title": "Avantage Produit", "description": "Description courte 1 phrase avec <strong>mot fort</strong>"}},
      {{"title": "Benefice Cle", "description": "Description courte 1 phrase avec <strong>expression d'impact</strong>"}},
      {{"title": "Resultat Visible", "description": "Description courte 1 phrase"}},
      {{"title": "Qualite Garantie", "description": "Description courte 1 phrase"}}
    ]
  }}
}}

CONTRAINTES :
- Exactement 5 product_benefits, 3 mini_reviews, 4 product_specs.items
- Les short_titles doivent etre courts (3-5 mots maximum)
- Les mini_reviews.text sont en texte simple (AUCUN HTML)
- Les champs HTML DOIVENT contenir plusieurs <strong> sur des expressions et mots d'impact
- product_specs.title OBLIGATOIREMENT au format : "Le [nom] qu'il vous faut" (ex: Le masque qu'il vous faut)
- product_specs.items[].title : EXACTEMENT 2 mots, representant un avantage ou benefice du produit (ex: Resultat Rapide, Formule Avancee, Confort Optimal, Zero Risque)
- Tous les textes HTML : MAX 2 paragraphes de 2 phrases courtes chacun
- Temoignages : MAX 2 phrases courtes, texte simple
- Sois specifique au produit, pas generique"""

    return system, user
