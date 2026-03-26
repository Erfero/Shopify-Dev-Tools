def build_homepage_prompt(context: dict) -> tuple[str, str]:
    """Prompt homepage — schéma identique à mock_generator.py / theme_modifier.py."""

    system = """Tu es un expert en copywriting e-commerce Shopify.
Tu generes du contenu persuasif et professionnel adapte au produit.
Les champs "text" richtext utilisent du HTML (<p>, <strong>).
Les champs "text" inline utilisent uniquement <strong> et <em>, SANS balises de bloc (<p>, <ul>...).
Les titres/headings sont du texte simple, sans HTML.
Tu reponds UNIQUEMENT en JSON valide, sans texte autour.

REGLE GRAS OBLIGATOIRE : Dans TOUS les champs HTML (richtext et inline), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-a-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte. Chaque champ HTML doit contenir au moins un <strong>.

REGLE SLOGAN : Le slogan suit TOUJOURS le format : NomBoutique : Promesse courte et percutante. Exemple : Roselash : Revelez un Regard Magnetique, Sans Colle, Sans Limite.

REGLE TITRES AVANTAGES : Chaque titre d'avantage doit etre une phrase imperative vendeuse commencant par un verbe d'action fort (Obtenez, Sculptez, Retrouvez, Adoptez, Rayonnez, Transformez, Decouvrez...) suivi d'un benefice specifique et concret du produit. Le texte associe doit faire EXACTEMENT 2 phrases courtes maximum — chaque phrase de 10 a 15 mots max. PAS PLUS.

REGLE LONGUEUR STRICTE : Tous les champs "text" et "description" (sauf les titres) doivent etre COURTS : maximum 2 phrases de 10-15 mots chacune. INTERDIT de faire des textes longs.

REGLE COMPARISON FEATURES : Chaque champ "feature" du tableau comparatif doit etre une expression COURTE et PRECISE de 3 a 5 mots MAXIMUM qui exprime un avantage concret, un benefice reel ou une caracteristique distinctive du produit. INTERDIT les expressions generiques et vagues (ex: "Qualite Premium", "Livraison rapide", "Tres bon produit"). OBLIGATOIRE d'aller droit au but avec des expressions percutantes et specifiques au produit (ex: "Resultats en 14 jours", "Sans sulfate ni parabene", "Certifie cruelty-free", "Tenue 24h garantie", "Ingrediants d'origine naturelle"). Chaque feature doit donner une raison forte et concrete d'acheter CE produit plutot qu'un autre. Sois TRES specifique au produit envoye."""

    products = ", ".join(context["product_names"])
    gender = context.get("target_gender", "femme")
    lang = context.get("language", "fr")
    store = context["store_name"]

    # Note sur la langue
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN."
    elif lang.lower().startswith("fr"):
        lang_note = "Genere TOUS les textes en FRANCAIS."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Do NOT write any French. Every single word must be in that language."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Observe-les attentivement :
- Decris le produit de facon precise et realiste (forme, couleur, materiau, style)
- Adapte le ton et le vocabulaire au type de produit que tu VOIS
- Evite les descriptions generiques : sois specifique a ce produit exact
""" if context.get("has_images") else ""

    user = f"""Boutique : {store}
Email : {context['store_email']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
Public cible : {gender}
{lang_note}
{image_note}
Genere tous les textes de la page d'accueil. Reponds en JSON avec ce schema EXACT :

{{
  "slogan": "{store} : Accroche courte et percutante — format OBLIGATOIRE : NomBoutique : Promesse vendeuse (ex: Roselash : Revelez un Regard Magnetique, Sans Colle, Sans Limite)",
  "cta_button_text": "Texte bouton CTA principal (ex: Decouvrir, Acheter maintenant)",
  "welcome": {{
    "title": "Titre de bienvenue (texte simple)",
    "text": "<p>2 phrases courtes. <strong>Mot d'impact</strong> pour presenter la boutique et le produit.</p>"
  }},
  "benefits": [
    {{"title": "Benefice cle 1 (texte simple)", "text": "Description courte inline avec <strong>mot fort</strong> (max 15 mots)"}},
    {{"title": "Benefice cle 2 (texte simple)", "text": "Description inline avec <strong>mot fort</strong>"}},
    {{"title": "Benefice cle 3 (texte simple)", "text": "Description inline avec <strong>mot fort</strong>"}}
  ],
  "advantages": [
    {{"title": "Verbe d'action + Benefice chiffre (ex: Obtenez un Regard Intensifie en 3 Semaines)", "text": "<p>Phrase 1 courte vendeuse avec <strong>expression percutante</strong>. Phrase 2 courte complementaire.</p>"}},
    {{"title": "Verbe d'action + Avantage unique (ex: Sculptez un Ovale Parfait Sans Effort)", "text": "<p>Phrase 1 courte avec <strong>mot d'impact</strong>. Phrase 2 courte.</p>"}},
    {{"title": "Verbe d'action + Resultat cle (ex: Retrouvez une Jeunesse Eclatante)", "text": "<p>Phrase 1 courte avec <strong>expression forte</strong>. Phrase 2 courte.</p>"}},
    {{"title": "Verbe d'action + Benefice pratique (ex: Adoptez un Rituel Simple et Efficace)", "text": "<p>Phrase 1 courte avec <strong>mot percutant</strong>. Phrase 2 courte.</p>"}},
    {{"title": "Verbe d'action + Benefice confiance (ex: Rayonnez de Confiance avec un Profil Sublime)", "text": "<p>Phrase 1 courte avec <strong>expression d'impact</strong>. Phrase 2 courte.</p>"}},
    {{"title": "Verbe d'action + Promesse forte", "text": "<p>Phrase 1 courte avec <strong>mot fort</strong>. Phrase 2 courte.</p>"}},
    {{"title": "Verbe d'action + Transformation finale (ex: Transformez votre Routine en Resultats)", "text": "<p>Phrase 1 courte avec <strong>tournure percutante</strong>. Phrase 2 courte.</p>"}}
  ],
  "comparison": {{
    "title": "Titre section comparaison (ex: Pourquoi choisir {store} ?)",
    "description": "Sous-titre inline motivant avec <strong>mot d'impact</strong>",
    "items": [
      {{"feature": "3-5 mots MAX : resultat ou benefice chiffre specifique au produit (ex: Resultats en 14 jours)", "tooltip": "Explication courte inline avec <strong>expression forte</strong>"}},
      {{"feature": "3-5 mots MAX : caracteristique composition ou formule distinctive (ex: Sans sulfate ni parabene)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}},
      {{"feature": "3-5 mots MAX : certifcation, label ou engagement qualite (ex: Certifie cruelty-free)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}},
      {{"feature": "3-5 mots MAX : avantage usage ou praticite du produit (ex: Tenue 24h garantie)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}},
      {{"feature": "3-5 mots MAX : promesse ou transformation concrete que le client va vivre (ex: Peau lissee en 7 jours)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}}
    ]
  }},
  "specs": {{
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
- Exactement 3 benefits, 7 advantages, 5 comparison.items, 4 specs.items
- comparison.items[].feature : 3 a 5 mots MAXIMUM — avantage, benefice ou caracteristique SPECIFIQUE et CONCRET au produit. INTERDIT les expressions generiques vagues ("Qualite Premium", "Livraison rapide", "Produit naturel"). Chaque feature doit aller droit au but et donner une raison forte et precise d'acheter ce produit plutot qu'un autre
- Chaque texte doit etre unique et different des autres
- Sois specifique au produit, pas generique
- Slogan OBLIGATOIREMENT au format : NomBoutique : Promesse percutante
- Titres advantages OBLIGATOIREMENT sous forme imperative (commencer par un verbe d'action fort)
- Textes advantages : EXACTEMENT 2 phrases courtes (10-15 mots chacune MAX), vendeurs, avec <strong>
- Texte welcome : EXACTEMENT 2 phrases courtes
- Descriptions benefits : 1 phrase courte MAX (10 mots)
- specs.title OBLIGATOIREMENT au format : "Le [nom] qu'il vous faut"
- specs.items[].title : EXACTEMENT 2 mots, avantage ou benefice du produit (ex: Resultat Rapide, Formule Avancee)
- Chaque champ HTML DOIT avoir au moins un <strong> sur un mot ou une expression d'impact
- Verifie que la JSON est valide avant de repondre"""

    return system, user
