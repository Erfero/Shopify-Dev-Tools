def build_legal_pages_prompt(context: dict) -> tuple[str, str]:
    """Prompt pages légales — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"conditions_vente": {title, content}, "mentions_legales": {title, content},
              "politique_expedition": {title, content}}
    """

    system = """Tu es un expert juridique spécialisé dans le e-commerce français.
Tu génères des pages légales complètes et bien structurées en HTML.
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés dans un français parfait et irréprochable : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords grammaticaux parfaits, orthographe sans faute. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres.

RÈGLE GRAS OBLIGATOIRE : Dans les contenus HTML des pages légales, tu DOIS placer en <strong>...</strong> les informations clés — délais, prix, durées, droits, coordonnées, obligations légales importantes. Chaque section doit avoir plusieurs <strong>."""

    store = context["store_name"]
    email = context["store_email"]
    products = ", ".join(context["product_names"])

    # Informations légales depuis le contexte étendu
    price = context.get("product_price") or "selon tarif en vigueur"
    price_str = f"{price} \u20ac" if price and price != "selon tarif en vigueur" else price
    address = context.get("store_address") or "Adresse disponible sur demande"
    siret = context.get("siret") or "En cours d'enregistrement"
    delay = context.get("delivery_delay") or "3-5 jours ouvrés"
    returns = context.get("return_policy_days") or "30"

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß)."
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Do NOT write any French."

    user = f"""Boutique : {store}
Email : {email}
Produit(s) : {products}
Prix : {price_str}
Adresse : {address}
SIRET : {siret}
Délai livraison : {delay}
Délai retour : {returns} jours
{lang_note}

Génère le contenu HTML complet pour 3 pages légales. Intègre les vraies informations fournies.
Structure avec des balises HTML (<h2>, <h3>, <p>, <ul>, <li>, <strong>, <a href="mailto:...">).
Mets en <strong> toutes les informations importantes : délais, prix, durées, droits, coordonnées.

Réponds en JSON avec ce schéma EXACT :

{{
  "conditions_vente": {{
    "title": "Conditions Générales de Vente",
    "content": "<h2>Conditions Générales de Vente \u2014 {store}</h2><h3>Article 1 : Objet</h3><p>Les présentes CGV régissent les ventes proposées par <strong>{store}</strong>.</p><h3>Article 2 : Prix</h3><p>Prix : <strong>{price_str}</strong> TTC.</p><h3>Article 3 : Livraison</h3><p>Expédition sous 24-48h. Délai : <strong>{delay}</strong>.</p><h3>Article 4 : Rétractation</h3><p><strong>{returns} jours</strong> à compter de la réception.</p><h3>Article 5 : Contact</h3><p><a href=\\"mailto:{email}\\">{email}</a></p>"
  }},
  "mentions_legales": {{
    "title": "Mentions Légales",
    "content": "<h2>Mentions Légales \u2014 {store}</h2><h3>Éditeur</h3><p><strong>{store}</strong></p><p>Adresse : {address}</p><p>SIRET : <strong>{siret}</strong></p><p>Email : <a href=\\"mailto:{email}\\">{email}</a></p><h3>Hébergement</h3><p>Shopify Inc. \u2014 150 Elgin St, Ottawa, ON K2P 1L4, Canada</p><h3>Données personnelles</h3><p>Conformément au <strong>RGPD</strong>, vous disposez d'un droit d'accès et de rectification. Contact : <a href=\\"mailto:{email}\\">{email}</a>.</p>"
  }},
  "politique_expedition": {{
    "title": "Politique d'Expédition",
    "content": "<h2>Politique d'Expédition \u2014 {store}</h2><h3>Traitement</h3><p>Commandes traitées sous <strong>24-48h ouvrées</strong>.</p><h3>Délais estimés</h3><ul><li><strong>France métropolitaine :</strong> {delay}</li><li><strong>Belgique, Suisse, Luxembourg :</strong> 5-10 jours ouvrés</li><li><strong>Europe :</strong> 7-14 jours ouvrés</li></ul><h3>Retours</h3><p>Retours acceptés sous <strong>{returns} jours</strong> sans justification.</p><h3>Contact</h3><p><a href=\\"mailto:{email}\\">{email}</a></p>"
  }}
}}

IMPORTANT : Génère un contenu HTML complet et professionnel, pas juste les templates ci-dessus.
Développe chaque section avec du contenu réel et détaillé (5-10 articles complets pour les CGV).
Intègre TOUTES les informations fournies (adresse, SIRET, email, délais, prix).
Utilise <strong> systématiquement sur toutes les informations clés pour le client."""

    return system, user
