def build_colors_prompt(context: dict) -> tuple[str, str]:
    """Build the prompt for generating color palettes."""

    lang = context.get("language", "fr")
    is_en = lang.lower().startswith("en")
    is_de = lang.lower().startswith("de")

    if is_en:
        lang_rule = "ABSOLUTE LANGUAGE QUALITY RULE: All generated texts (palette names, descriptions) MUST be written in perfect English. Zero spelling errors."
        lang_note = "Generate ALL palette names and descriptions in ENGLISH."
        intro = f"""Here is my Shopify store information:
- Store name: {context['store_name']}
- Product(s): {', '.join(context['product_names'])}
{f"- Description: {context['product_description']}" if context.get('product_description') else ""}"""
        request = "Please suggest 3 color palette proposals to showcase my product(s).\nChoose colors based on the product, its characteristics and universe."
    elif is_de:
        lang_rule = "ABSOLUTE SPRACHQUALITÄTSREGEL: Alle generierten Texte (Palettennamen, Beschreibungen) MÜSSEN in perfektem Deutsch geschrieben sein. Alle Umlaute (ä, ö, ü, ß) und Großschreibung von Substantiven."
        lang_note = "Generate ALL palette names and descriptions in GERMAN."
        intro = f"""Hier sind die Informationen zu meinem Shopify-Shop:
- Shop-Name: {context['store_name']}
- Produkt(e): {', '.join(context['product_names'])}
{f"- Beschreibung: {context['product_description']}" if context.get('product_description') else ""}"""
        request = "Bitte schlage 3 Farbpaletten vor, um mein(e) Produkt(e) in Szene zu setzen.\nWähle Farben passend zum Produkt, seinen Eigenschaften und seinem Universum."
    else:
        lang_rule = "RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés (noms de palettes, descriptions) doivent être rédigés dans un français parfait : tous les accents obligatoires (é, è, ê, à, â, ç, ù, û, î, ô, œ), orthographe sans faute."
        lang_note = "Génère TOUS les noms de palettes et descriptions en FRANÇAIS parfait."
        intro = f"""Voici les informations de ma boutique Shopify :
- Nom de la boutique : {context['store_name']}
- Produit(s) : {', '.join(context['product_names'])}
{f"- Description : {context['product_description']}" if context.get('product_description') else ""}"""
        request = "J'aimerais que tu me fasses 3 propositions de palette de couleurs pour mettre en valeur mon/mes produit(s).\nChoisis bien les couleurs en fonction du produit, de ses caractéristiques et de son univers."

    system = f"""Tu es un expert en design UI/UX et en branding pour boutiques e-commerce.
Tu réponds UNIQUEMENT en JSON valide, sans texte supplémentaire.

{lang_rule}"""

    image_note = """
IMPORTANT : Des images du produit sont jointes à ce message. Analyse-les attentivement pour :
- Identifier les couleurs dominantes du produit
- Comprendre l'univers visuel et le style du produit
- Proposer des palettes qui s'harmonisent avec l'apparence réelle du produit
""" if context.get("has_images") else ""

    user = f"""{intro}
{image_note}
{lang_note}
{request}

Chaque palette doit contenir :
- Une couleur de fond principale (background)
- Une couleur de texte (text)
- Une couleur d'accent principale (accent1) - pour les boutons, liens
- Une couleur d'accent secondaire (accent2) - pour les éléments complémentaires
- Une couleur de fond secondaire (bg_secondary) - pour les sections alternées

Réponds en JSON avec ce format exact :
{{
  "palettes": [
    {{
      "name": "Nom de la palette",
      "description": "Courte description de l'ambiance",
      "colors": {{
        "background": "#ffffff",
        "background_secondary": "#f2f2f2",
        "text": "#000000",
        "text_secondary": "#333333",
        "accent1": "#8256b0",
        "accent2": "#5c3b7b"
      }}
    }}
  ]
}}"""

    return system, user
