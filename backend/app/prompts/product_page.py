def build_product_page_prompt(context: dict) -> tuple[str, str]:
    """Prompt page produit — schéma identique à mock_generator.py / theme_modifier.py."""

    system = """Tu es un expert en copywriting e-commerce. Tu crées du contenu produit détaillé et convaincant.
Les champs "text" richtext utilisent du HTML (<p>, <strong>).
Les headings et short_titles sont du texte simple, sans HTML.
Les textes des mini_reviews sont du texte simple (pas de HTML).
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés dans un français parfait et irréprochable : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords grammaticaux parfaits, orthographe sans faute. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres.

RÈGLE GRAS OBLIGATOIRE : Dans TOUS les champs HTML (product_description.text, how_it_works.text, adoption.text), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-à-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur. Chaque champ HTML doit contenir plusieurs <strong>.

RÈGLE INGRÉDIENTS : Si le produit est un produit naturel (savon, huile essentielle, sérum, cire, lotion, crème, gel, shampoing, beurre de karité, huile de soin, etc.) : dans le champ adoption, heading = 'Nos ingrédients' ET text = description HTML des ingrédients principaux avec leurs bénéfices. Sinon : heading = social proof chiffré + public, text = social proof.

RÈGLE LONGUEUR STRICTE : Tous les champs "text" sont COURTS. Maximum 2 phrases par paragraphe, maximum 2 paragraphes. Chaque phrase fait 10-15 mots MAX. PAS de longs textes."""

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
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß)."
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Do NOT write any French."

    image_note = """
IMPORTANT : Des images du produit sont jointes. C'est CRUCIAL pour cette page :
- Décris le produit en te basant sur ce que tu VOIS (forme, taille, couleur, matériau, design)
- Les caractéristiques et avantages doivent correspondre au produit RÉEL visible
- Sois précis et concret, pas générique
""" if context.get("has_images") else ""

    user = f"""Boutique : {store}
Produit : {product}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
Public cible : {plural_label}
{lang_note}
{image_note}
Génère les textes de la page produit. Réponds en JSON avec ce schéma EXACT :

{{
  "product_benefits": [
    {{"short_title": "Bénéfice court 1 (texte simple, ~3-4 mots)", "description": "Explication courte (1 phrase, texte simple)"}},
    {{"short_title": "Bénéfice court 2", "description": "Explication courte"}},
    {{"short_title": "Bénéfice court 3", "description": "Explication courte"}},
    {{"short_title": "Bénéfice court 4", "description": "Explication courte"}},
    {{"short_title": "Bénéfice court 5", "description": "Explication courte"}}
  ],
  "product_description": {{
    "heading": "Description (texte simple)",
    "text": "<p>2 phrases courtes avec <strong>expression d'impact</strong>.</p><p>2 autres phrases courtes avec <strong>mot fort</strong>.</p>"
  }},
  "how_it_works": {{
    "heading": "Comment ça marche ? (texte simple)",
    "text": "<p>2 phrases courtes expliquant le mécanisme avec <strong>mots d'impact</strong>.</p><p>2 phrases courtes sur les bénéfices.</p>"
  }},
  "adoption": {{
    "heading": "RÈGLE : Si le produit est à base d'ingrédients naturels (savon, huile essentielle, sérum, cire, beurre de karité, lotion, crème, gel, shampoing, sérum de cils, huile de soin, etc.) → écris EXACTEMENT 'Nos ingrédients'. Sinon → écris '+XXXX {plural_label} l\\'ont adopté' avec un chiffre réaliste et percutant.",
    "text": "RÈGLE : Si produit naturel → '<p>Liste les <strong>ingrédients clés</strong> du produit avec leurs bénéfices spécifiques.</p><p>Phrase courte sur la <strong>qualité et l\\'origine</strong> des ingrédients.</p>'. Sinon → '<p>2 phrases social proof courtes avec <strong>expression percutante</strong>.</p>'"
  }},
  "mini_reviews": [
    {{"name": "Prénom N. (cohérent avec public {gender})", "age": "XX ans", "text": "Témoignage court : 2 phrases simples sans HTML."}},
    {{"name": "Prénom N.", "age": "XX ans", "text": "Témoignage court différent : 2 phrases."}},
    {{"name": "Prénom N.", "age": "XX ans", "text": "Témoignage court différent : 2 phrases."}}
  ],
  "product_specs": {{
    "title": "Le [nom-court-du-produit] qu'il vous faut (format OBLIGATOIRE : Le + nom ou catégorie courte + qu'il vous faut, ex: Le masque qu'il vous faut, Le sérum qu'il vous faut)",
    "items": [
      {{"title": "Avantage Produit", "description": "Description courte 1 phrase avec <strong>mot fort</strong>"}},
      {{"title": "Bénéfice Clé", "description": "Description courte 1 phrase avec <strong>expression d'impact</strong>"}},
      {{"title": "Résultat Visible", "description": "Description courte 1 phrase"}},
      {{"title": "Qualité Garantie", "description": "Description courte 1 phrase"}}
    ]
  }}
}}

CONTRAINTES :
- Exactement 5 product_benefits, 3 mini_reviews, 4 product_specs.items
- adoption.heading : 'Nos ingrédients' si produit naturel/ingrédient, sinon '+XXXX {plural_label} l\\'ont adopté'
- Les short_titles doivent être courts (3-5 mots maximum)
- Les mini_reviews.text sont en texte simple (AUCUN HTML)
- Les champs HTML DOIVENT contenir plusieurs <strong> sur des expressions et mots d'impact
- product_specs.title OBLIGATOIREMENT au format : "Le [nom] qu'il vous faut" (ex: Le masque qu'il vous faut)
- product_specs.items[].title : EXACTEMENT 2 mots, représentant un avantage ou bénéfice du produit (ex: Résultat Rapide, Formule Avancée, Confort Optimal, Zéro Risque)
- Tous les textes HTML : MAX 2 paragraphes de 2 phrases courtes chacun
- Témoignages : MAX 2 phrases courtes, texte simple
- Sois spécifique au produit, pas générique"""

    return system, user
