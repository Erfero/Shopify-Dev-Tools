def build_homepage_prompt(context: dict) -> tuple[str, str]:
    """Prompt homepage — schéma identique à mock_generator.py / theme_modifier.py."""

    system = """Tu es un expert en copywriting e-commerce Shopify.
Tu génères du contenu persuasif et professionnel adapté au produit.
Les champs "text" richtext utilisent du HTML (<p>, <strong>).
Les champs "text" inline utilisent uniquement <strong> et <em>, SANS balises de bloc (<p>, <ul>...).
Les titres/headings sont du texte simple, sans HTML.
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés dans un français parfait et irréprochable : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords grammaticaux parfaits, orthographe sans faute. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres.

RÈGLE GRAS OBLIGATOIRE : Dans TOUS les champs HTML (richtext et inline), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-à-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur et donnent de la puissance au texte. Chaque champ HTML doit contenir au moins un <strong>.

RÈGLE SLOGAN : Le slogan suit TOUJOURS le format : NomBoutique : Promesse courte et percutante. Exemple : Roselash : Révélez un Regard Magnétique, Sans Colle, Sans Limite.

RÈGLE TITRES AVANTAGES : Chaque titre d'avantage DOIT être une phrase impérative VENDEUSE et ÉMOTIONNELLEMENT PUISSANTE commençant par un verbe d'action fort et percutant (Obtenez, Sculptez, Retrouvez, Adoptez, Rayonnez, Transformez, Découvrez, Libérez, Révélez, Éliminez, Boostez, Reprenez...). Le titre doit promettre un RÉSULTAT CONCRET et DÉSIRÉ, idéalement avec un chiffre ou une précision (ex: "Obtenez des Résultats Visibles en 14 Jours", "Retrouvez une Peau Lissée à 90%", "Éliminez la Douleur Dès la 1ère Utilisation"). Le texte associé doit faire EXACTEMENT 2 phrases courtes — chaque phrase de 10 à 15 mots max. La 1ère phrase formule le problème résolu ou la transformation. La 2ème phrase renforce avec un bénéfice émotionnel ou une preuve.

RÈGLE LONGUEUR STRICTE : Tous les champs "text" et "description" (sauf les titres) doivent être COURTS : maximum 2 phrases de 10-15 mots chacune. INTERDIT de faire des textes longs.

RÈGLE PERSUASION MAXIMALE : Les textes "advantages" doivent déclencher une ÉMOTION FORTE. Utilise des formules qui créent de l'urgence, de la désirabilité ou de la peur de manquer (FOMO). Évoque des transformations de vie réelles, des résultats mesurables, des douleurs résolues. Chaque avantage doit faire ressentir AU LECTEUR qu'il a BESOIN de ce produit.

RÈGLE COMPARISON FEATURES : Chaque champ "feature" du tableau comparatif doit être une expression ULTRA-COURTE et ULTRA-PERCUTANTE de 2 à 5 mots MAXIMUM — JAMAIS plus de 5 mots, JAMAIS plus de 6 mots. Exprime un résultat chiffré, une composition distinctive, une certification ou un bénéfice unique du produit. INTERDIT les expressions génériques et vagues (ex: "Qualité Premium", "Livraison rapide", "Très bon produit", "Efficacité prouvée", "Grande qualité"). OBLIGATOIRE: expressions percutantes et SPÉCIFIQUES à CE produit exact (ex: "Résultats en 14 jours", "Sans sulfate ni parabène", "Certifié cruelty-free", "Tenue 24h garantie", "Formule brevetée", "Testé dermatologiquement", "-80% de douleur"). Chaque feature doit frapper l'esprit du lecteur et donner une raison forte et concrète d'acheter CE produit plutôt qu'un autre. Sois TRÈS spécifique au produit envoyé."""

    products = ", ".join(context["product_names"])
    gender = context.get("target_gender", "femme")
    lang = context.get("language", "fr")
    store = context["store_name"]

    # Note sur la langue
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation. No missing letters or accents."
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization (Substantive with capital letters) and all umlauts (ä, ö, ü, ß). No missing accents or special characters."
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters for that language. Do NOT write any French. Every single word must be in that language."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Observe-les attentivement :
- Décris le produit de façon précise et réaliste (forme, couleur, matériau, style)
- Adapte le ton et le vocabulaire au type de produit que tu VOIS
- Évite les descriptions génériques : sois spécifique à ce produit exact
""" if context.get("has_images") else ""

    user = f"""Boutique : {store}
Email : {context['store_email']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
Public cible : {gender}
{lang_note}
{image_note}
Génère tous les textes de la page d'accueil. Réponds en JSON avec ce schéma EXACT :

{{
  "slogan": "{store} : Accroche courte et percutante — format OBLIGATOIRE : NomBoutique : Promesse vendeuse (ex: Roselash : Révélez un Regard Magnétique, Sans Colle, Sans Limite)",
  "cta_button_text": "Texte bouton CTA principal (ex: Découvrir, Acheter maintenant)",
  "welcome": {{
    "title": "Titre de bienvenue (texte simple)",
    "text": "<p>2 phrases courtes. <strong>Mot d'impact</strong> pour présenter la boutique et le produit.</p>"
  }},
  "benefits": [
    {{"title": "Bénéfice clé 1 (texte simple)", "text": "Description courte inline avec <strong>mot fort</strong> (max 15 mots)"}},
    {{"title": "Bénéfice clé 2 (texte simple)", "text": "Description inline avec <strong>mot fort</strong>"}},
    {{"title": "Bénéfice clé 3 (texte simple)", "text": "Description inline avec <strong>mot fort</strong>"}}
  ],
  "advantages": [
    {{"title": "Verbe d'action fort + Résultat CHIFFRÉ spécifique au produit (ex: Obtenez des Résultats Visibles en 14 Jours, Retrouvez une Peau Lissée à 90%, Éliminez la Douleur Dès la 1ère Utilisation)", "text": "<p>Phrase 1 : problème résolu ou transformation vécue avec <strong>bénéfice clé</strong>. Phrase 2 : renfort émotionnel ou preuve concrète.</p>"}},
    {{"title": "Verbe fort + Avantage exclusif du produit (ex: Sculptez un Ovale Parfait en 3 Semaines, Libérez-vous de la Douleur Chronique, Révélez un Éclat Naturel Immédiat)", "text": "<p>Phrase 1 vendeuse avec <strong>expression d'impact</strong>. Phrase 2 courte complémentaire.</p>"}},
    {{"title": "Verbe fort + Promesse de résultat concret (ex: Retrouvez l'Énergie de Vos 20 Ans, Transformez Votre Corps en 30 Jours, Boostez Votre Confiance en Quelques Semaines)", "text": "<p>Phrase 1 avec <strong>bénéfice transformatif</strong>. Phrase 2 courte de renfort.</p>"}},
    {{"title": "Verbe fort + Facilité ou praticité (ex: Adoptez un Rituel de 5 Minutes Seulement, Utilisez Partout Sans Contrainte, Reprenez le Contrôle Facilement)", "text": "<p>Phrase 1 avec <strong>avantage pratique fort</strong>. Phrase 2 courte.</p>"}},
    {{"title": "Verbe fort + Bénéfice émotionnel puissant (ex: Rayonnez de Confiance Chaque Jour, Retrouvez Votre Sérénité Perdue, Découvrez la Liberté que Vous Méritez)", "text": "<p>Phrase 1 émotionnelle avec <strong>expression percutante</strong>. Phrase 2 courte de preuve.</p>"}},
    {{"title": "Verbe fort + Garantie ou sécurité (ex: Obtenez un Remboursement si Non Satisfait, Profitez d'une Technologie Certifiée, Bénéficiez d'une Formule Testée Cliniquement)", "text": "<p>Phrase 1 avec <strong>argument de confiance</strong>. Phrase 2 courte de réassurance.</p>"}},
    {{"title": "Verbe fort + Transformation ultime (ex: Transformez Votre Quotidien Dès Maintenant, Rejoignez des Milliers de Clients Satisfaits, Vivez la Différence Dès J+1)", "text": "<p>Phrase 1 avec <strong>appel à l'action émotionnel</strong>. Phrase 2 courte de clôture persuasive.</p>"}}
  ],
  "comparison": {{
    "title": "Titre section comparaison (ex: Pourquoi choisir {store} ?)",
    "description": "Sous-titre inline motivant avec <strong>mot d'impact</strong>",
    "items": [
      {{"feature": "3-5 mots MAX : résultat ou bénéfice chiffré spécifique au produit (ex: Résultats en 14 jours)", "tooltip": "Explication courte inline avec <strong>expression forte</strong>"}},
      {{"feature": "3-5 mots MAX : caractéristique composition ou formule distinctive (ex: Sans sulfate ni parabène)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}},
      {{"feature": "3-5 mots MAX : certification, label ou engagement qualité (ex: Certifié cruelty-free)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}},
      {{"feature": "3-5 mots MAX : avantage usage ou praticité du produit (ex: Tenue 24h garantie)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}},
      {{"feature": "3-5 mots MAX : promesse ou transformation concrète que le client va vivre (ex: Peau lissée en 7 jours)", "tooltip": "Explication inline avec <strong>mot fort</strong>"}}
    ]
  }},
  "specs": {{
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
- Exactement 3 benefits, 7 advantages, 5 comparison.items, 4 specs.items
- comparison.items[].feature : 2 à 5 mots MAXIMUM, JAMAIS 6 mots ou plus — résultat chiffré, composition, certification ou bénéfice unique SPÉCIFIQUE à CE produit exact. INTERDIT ABSOLUMENT les expressions génériques ("Qualité Premium", "Livraison rapide", "Produit naturel", "Très efficace", "Meilleur produit")
- Titres advantages : OBLIGATOIREMENT impératifs, vendeurs, avec résultat CONCRET ou chiffre (ex: "Obtenez des Résultats Visibles en 14 Jours", "Retrouvez une Peau Lissée à 90%"). INTERDIT les titres vagues ou génériques
- Textes advantages : EXACTEMENT 2 phrases courtes (10-15 mots chacune MAX), ultra-vendeurs, avec <strong> sur les expressions d'impact. Phrase 1 = transformation/problème résolu. Phrase 2 = renfort émotionnel ou preuve
- Chaque texte doit être unique et différent des autres
- Sois TRÈS spécifique au produit envoyé, pas générique
- Slogan OBLIGATOIREMENT au format : NomBoutique : Promesse percutante
- Texte welcome : EXACTEMENT 2 phrases courtes
- Descriptions benefits : 1 phrase courte MAX (10 mots)
- specs.title OBLIGATOIREMENT au format : "Le [nom] qu'il vous faut"
- specs.items[].title : EXACTEMENT 2 mots, avantage ou bénéfice du produit (ex: Résultat Rapide, Formule Avancée)
- Chaque champ HTML DOIT avoir au moins un <strong> sur un mot ou une expression d'impact
- Vérifie que le JSON est valide avant de répondre"""

    return system, user
