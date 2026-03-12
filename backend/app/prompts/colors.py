def build_colors_prompt(context: dict) -> tuple[str, str]:
    """Build the prompt for generating color palettes."""

    system = """Tu es un expert en design UI/UX et en branding pour boutiques e-commerce.
Tu reponds UNIQUEMENT en JSON valide, sans texte supplementaire."""

    image_note = """
IMPORTANT : Des images du produit sont jointes a ce message. Analyse-les attentivement pour :
- Identifier les couleurs dominantes du produit
- Comprendre l'univers visuel et le style du produit
- Proposer des palettes qui s'harmonisent avec l'apparence reelle du produit
""" if context.get("has_images") else ""

    user = f"""Voici les informations de ma boutique Shopify :
- Nom de la boutique : {context['store_name']}
- Produit(s) : {', '.join(context['product_names'])}
{f"- Description : {context['product_description']}" if context.get('product_description') else ""}
{image_note}
J'aimerais que tu me fasses 3 propositions de palette de couleurs pour mettre en valeur mon/mes produit(s).
Choisis bien les couleurs en fonction du produit, de ses caracteristiques et de son univers.

Chaque palette doit contenir :
- Une couleur de fond principale (background)
- Une couleur de texte (text)
- Une couleur d'accent principale (accent1) - pour les boutons, liens
- Une couleur d'accent secondaire (accent2) - pour les elements complementaires
- Une couleur de fond secondaire (bg_secondary) - pour les sections alternees

Reponds en JSON avec ce format exact :
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
