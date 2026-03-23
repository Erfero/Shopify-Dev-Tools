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
Tu generes du contenu pour les elements globaux du theme (header, footer, panier).
Les trust_badges.description sont du HTML inline (<strong> uniquement, pas de <p>).
Les autres champs sont du texte simple sauf brand_text (HTML <p><strong>).
Tu reponds UNIQUEMENT en JSON valide, sans texte autour.

REGLE GRAS OBLIGATOIRE : Dans brand_text et trust_badges.description (champs HTML), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-a-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte."""

    products = ", ".join(context["product_names"])
    store = context["store_name"]

    lang = context.get("language", "fr")
    is_fr = lang.lower().startswith("fr")
    is_en = lang.lower().startswith("en")
    is_de = lang.lower().startswith("de")

    if is_en:
        lang_note = "Generate ALL texts in ENGLISH."
    elif is_de:
        lang_note = "Generate ALL texts in GERMAN."
    elif is_fr:
        lang_note = "Genere TOUS les textes en FRANCAIS."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Do NOT write any French. Every single word must be in that language."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Adapte les textes globaux au produit REEL.
""" if context.get("has_images") else ""

    # Pour le francais, header et newsletter restent vides
    if is_fr:
        header_instruction = """  "header": {{
    "announcement_timer": "",
    "announcement_marquee": ""
  }},"""
        footer_badges_instruction = '  "trust_badges": [],'
        newsletter_instruction = """    "newsletter_heading": "",
    "newsletter_text": "","""
        link_list_instruction = '  "link_list_headings": [],'
        fr_note = "\nIMPORTANT : Pour le francais, laisse VIDES : announcement_timer, announcement_marquee, trust_badges, newsletter_heading, newsletter_text, link_list_headings.\nGenere uniquement brand_text pour le footer francais.\n"
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
      {{"heading": "Sichere Zahlung", "description": "<strong>100% sichere</strong> SSL-verschlusselte Transaktionen."}},
      {{"heading": "Zufriedenheitsgarantie", "description": "Kostenlose Rucksendung innerhalb von <strong>30 Tagen</strong>."}},
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
Genere les textes globaux du theme Shopify. Reponds en JSON avec ce schema EXACT :

{{
  {header_instruction}
  "footer": {{
    {footer_badges_instruction}
    "brand_text": "<p><strong>{store}</strong> est votre partenaire dedie, offrant des <strong>solutions innovantes</strong> pour sublimer votre quotidien.</p>",
    {newsletter_instruction}
    {link_list_instruction}
  }},
  "cart": {{
    "button_text": "Texte bouton panier (ex: COMMANDER MAINTENANT)",
    "upsell_title": "Titre upsell panier (ex: Completez votre commande)",
    "upsell_button_text": "Ajouter",
    "protection_text": "Protection colis incluse",
    "savings_text": "Vous economisez",
    "subtotal_text": "Sous-Total",
    "total_text": "Total",
    "cart_footer_text": "Texte bas de panier avec emojis trust (ex: Paiement securise | Livraison rapide)"
  }},
  "delivery": {{
    "today_info": "Commande",
    "ready_info": "Commande Prete",
    "delivered_info": "Livraison"
  }},
  "settings": {{
    "product_card_button_text": "Texte bouton fiche produit (ex: Ajouter au panier)",
    "timer_timeout_text": "Offre expiree"
  }}
}}

CONTRAINTES :
- Respecte scrupuleusement la politique langue ci-dessus (vide pour FR, traduit pour EN/DE)
- brand_text est du HTML avec <p> et plusieurs <strong> sur le nom de marque et les promesses cles
- trust_badges.description utilisent uniquement <strong> (pas de <p>) — chaque badge doit avoir un <strong>
- Les autres textes (cart, delivery, settings) sont du texte simple
- Adapte le vocabulaire au produit : {products}"""

    return system, user
