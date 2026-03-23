def build_legal_pages_prompt(context: dict) -> tuple[str, str]:
    """Prompt pages légales — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"conditions_vente": {title, content}, "mentions_legales": {title, content},
              "politique_expedition": {title, content}}
    """

    system = """Tu es un expert juridique specialise dans le e-commerce francais.
Tu generes des pages legales completes et bien structurees en HTML.
Tu reponds UNIQUEMENT en JSON valide, sans texte autour.

REGLE GRAS OBLIGATOIRE : Dans les contenus HTML des pages legales, tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-a-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte. Chaque section doit avoir plusieurs <strong>."""

    store = context["store_name"]
    email = context["store_email"]
    products = ", ".join(context["product_names"])

    # Informations legales depuis le contexte etendu
    price = context.get("product_price") or "selon tarif en vigueur"
    price_str = f"{price} \u20ac" if price and price != "selon tarif en vigueur" else price
    address = context.get("store_address") or "Adresse disponible sur demande"
    siret = context.get("siret") or "En cours d'enregistrement"
    delay = context.get("delivery_delay") or "3-5 jours ouvres"
    returns = context.get("return_policy_days") or "30"

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN."
    elif lang.lower().startswith("fr"):
        lang_note = "Genere TOUS les textes en FRANCAIS."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Do NOT write any French. Every single word must be in that language."

    user = f"""Boutique : {store}
Email : {email}
Produit(s) : {products}
Prix : {price_str}
Adresse : {address}
SIRET : {siret}
Delai livraison : {delay}
Delai retour : {returns} jours
{lang_note}

Genere le contenu HTML complet pour 3 pages legales. Integre les vraies informations fournies.
Structure avec des balises HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a href="mailto:...">).
Mets en <strong> toutes les informations importantes : delais, prix, durees, droits, coordonnees.

Reponds en JSON avec ce schema EXACT :

{{
  "conditions_vente": {{
    "title": "Conditions Generales de Vente",
    "content": "<h2>Conditions Generales de Vente \u2014 {store}</h2><h3>Article 1 : Objet</h3><p>Les presentes CGV regissent les ventes proposees par <strong>{store}</strong>.</p><h3>Article 2 : Prix</h3><p>Prix : <strong>{price_str}</strong> TTC.</p><h3>Article 3 : Livraison</h3><p>Expedition sous 24-48h. Delai : <strong>{delay}</strong>.</p><h3>Article 4 : Retractation</h3><p><strong>{returns} jours</strong> a compter de la reception.</p><h3>Article 5 : Contact</h3><p><a href=\\"mailto:{email}\\">{email}</a></p>"
  }},
  "mentions_legales": {{
    "title": "Mentions Legales",
    "content": "<h2>Mentions Legales \u2014 {store}</h2><h3>Editeur</h3><p><strong>{store}</strong></p><p>Adresse : {address}</p><p>SIRET : <strong>{siret}</strong></p><p>Email : <a href=\\"mailto:{email}\\">{email}</a></p><h3>Hebergement</h3><p>Shopify Inc. \u2014 150 Elgin St, Ottawa, ON K2P 1L4, Canada</p><h3>Donnees personnelles</h3><p>Conformement au <strong>RGPD</strong>, vous disposez d'un droit d'acces et de rectification. Contact : <a href=\\"mailto:{email}\\">{email}</a>.</p>"
  }},
  "politique_expedition": {{
    "title": "Politique d'Expedition",
    "content": "<h2>Politique d'Expedition \u2014 {store}</h2><h3>Traitement</h3><p>Commandes traitees sous <strong>24-48h ouvrees</strong>.</p><h3>Delais estimes</h3><ul><li><strong>France metropolitaine :</strong> {delay}</li><li><strong>Belgique, Suisse, Luxembourg :</strong> 5-10 jours ouvres</li><li><strong>Europe :</strong> 7-14 jours ouvres</li></ul><h3>Retours</h3><p>Retours acceptes sous <strong>{returns} jours</strong> sans justification.</p><h3>Contact</h3><p><a href=\\"mailto:{email}\\">{email}</a></p>"
  }}
}}

IMPORTANT : Genere un contenu HTML complet et professionnel, pas juste les templates ci-dessus.
Developpe chaque section avec du contenu reel et detaille (5-10 articles complets pour les CGV).
Integre TOUTES les informations fournies (adresse, SIRET, email, delais, prix).
Utilise <strong> systematiquement sur toutes les informations cles pour le client."""

    return system, user
