def build_global_texts_prompt(context: dict) -> tuple[str, str]:
    """Prompt textes globaux — schéma identique à mock_generator.py / theme_modifier.py.

    Schema :
      header: {announcement_timer, announcement_marquee}
      footer:  {trust_badges[4], brand_text, newsletter_heading, newsletter_text,
                link_list_headings[]}
      cart:    {button_text, upsell_title, upsell_button_text, protection_text,
                savings_text, subtotal_text, total_text, cart_footer_text}
      delivery:{today_info, ready_info, delivered_info}
      settings:{product_card_button_text, timer_timeout_text}

    POLITIQUE LANGUE :
      FR → header vide, trust_badges=[], newsletter vide (le theme Story gere nativement)
      EN/DE → tous les champs traduits
    """

    system = """Tu es un expert en copywriting e-commerce Shopify.
Tu génères du contenu pour les éléments globaux du thème (header, footer, panier).
Les trust_badges.description sont du HTML inline (<strong> uniquement, pas de <p>).
Les autres champs sont du texte simple sauf brand_text (HTML <p><strong>).
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés avec une orthographe et une grammaire parfaites dans la langue demandée. Pour le français : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords parfaits. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres.

RÈGLE GRAS OBLIGATOIRE : Dans brand_text et trust_badges.description (champs HTML), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-à-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte."""

    products = ", ".join(context["product_names"])
    store = context["store_name"]

    lang = context.get("language", "fr")
    is_fr = lang.lower().startswith("fr")
    is_en = lang.lower().startswith("en")
    is_de = lang.lower().startswith("de")

    if is_en:
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation."
    elif is_de:
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß)."
    elif is_fr:
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Do NOT write any French."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Adapte les textes globaux au produit RÉEL.
""" if context.get("has_images") else ""

    # Pour le français, header et newsletter restent vides
    if is_fr:
        header_instruction = """  "header": {{
    "announcement_timer": "",
    "announcement_marquee": ""
  }},"""
        footer_badges_instruction = '  "trust_badges": [],'
        newsletter_instruction = """    "newsletter_heading": "",
    "newsletter_text": "","""
        link_list_instruction = '  "link_list_headings": [],'
        fr_note = "\nIMPORTANT : Pour le français, laisse VIDES : announcement_timer, announcement_marquee, trust_badges, newsletter_heading, newsletter_text, link_list_headings.\nGénère uniquement brand_text pour le footer français.\n"
    elif is_en:
        header_instruction = """  "header": {{
    "announcement_timer": "SPECIAL OFFER: Free shipping on all orders!",
    "announcement_marquee": "FREE SHIPPING | RESULTS GUARANTEED | SECURE PAYMENT | 4.9/5 RATING"
  }},"""
        footer_badges_instruction = """  "trust_badges": [
      {{"heading": "Fast Delivery", "description": "Tracked shipping in <strong>2-5 business days</strong>."}},
      {{"heading": "Secure Payment", "description": "<strong>100% secure</strong> SSL-encrypted transactions."}},
      {{"heading": "Satisfaction Guaranteed", "description": "Free returns within <strong>30 days</strong>."}},
      {{"heading": "Customer Support", "description": "Dedicated team available <strong>7 days a week</strong>."}}
    ],"""
        newsletter_instruction = """    "newsletter_heading": "JOIN THE {store.upper()} FAMILY!",
    "newsletter_text": "Get <strong>-10%</strong> on your first order and exclusive offers.","""
        link_list_instruction = '  "link_list_headings": ["IMPORTANT INFORMATION", "LEGAL INFORMATION"],'
        fr_note = ""
    else:  # DE
        header_instruction = """  "header": {{
    "announcement_timer": "SONDERANGEBOT: Kostenloser Versand auf alle Bestellungen!",
    "announcement_marquee": "GRATIS VERSAND | ERGEBNISSE GARANTIERT | SICHERE ZAHLUNG | 4,9/5 BEWERTUNG"
  }},"""
        footer_badges_instruction = """  "trust_badges": [
      {{"heading": "Schnelle Lieferung", "description": "Versand mit Sendungsverfolgung in <strong>2-5 Werktagen</strong>."}},
      {{"heading": "Sichere Zahlung", "description": "<strong>100% sichere</strong> SSL-verschlüsselte Transaktionen."}},
      {{"heading": "Zufriedenheitsgarantie", "description": "Kostenlose Rücksendung innerhalb von <strong>30 Tagen</strong>."}},
      {{"heading": "Kundendienst", "description": "Unser Team ist <strong>7 Tage die Woche</strong> per E-Mail erreichbar."}}
    ],"""
        newsletter_instruction = """    "newsletter_heading": "WERDEN SIE TEIL DER {store.upper()}-FAMILIE!",
    "newsletter_text": "<strong>-10%</strong> auf Ihre erste Bestellung und exklusive Angebote.","""
        link_list_instruction = '  "link_list_headings": ["WICHTIGE INFORMATIONEN", "RECHTLICHE INFORMATIONEN"],'
        fr_note = ""

    user = f"""Boutique : {store}
Email : {context['store_email']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{lang_note}
{image_note}{fr_note}
Génère les textes globaux du thème Shopify. Réponds en JSON avec ce schéma EXACT :

{{
  {header_instruction}
  "footer": {{
    {footer_badges_instruction}
    "brand_text": "<p><strong>{store}</strong> est votre partenaire dédié, offrant des <strong>solutions innovantes</strong> pour sublimer votre quotidien.</p>",
    {newsletter_instruction}
    {link_list_instruction}
  }},
  "cart": {{}},
  "delivery": {{}},
  "settings": {{}}
}}

CONTRAINTES :
- Respecte scrupuleusement la politique langue ci-dessus (vide pour FR, traduit pour EN/DE)
- brand_text est du HTML avec <p> et plusieurs <strong> sur le nom de marque et les promesses clés
- trust_badges.description utilisent uniquement <strong> (pas de <p>) — chaque badge doit avoir un <strong>
- Les champs cart, delivery, settings doivent rester VIDES (objets vides {{}}) — ils sont gérés par des traductions fixes côté serveur
- Adapte le vocabulaire au produit : {products}"""

    return system, user
