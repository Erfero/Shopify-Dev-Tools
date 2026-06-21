_INGREDIENTS_HEADING = {
    "fr": "Nos ingrédients",
    "en": "Our ingredients",
    "de": "Unsere Zutaten",
    "es": "Nuestros ingredientes",
    "it": "I nostri ingredienti",
    "pt": "Nossos ingredientes",
    "nl": "Onze ingrediënten",
    "da": "Vores ingredienser",
    "sv": "Våra ingredienser",
    "no": "Våre ingredienser",
    "fi": "Ainesosamme",
    "pl": "Nasze składniki",
    "cs": "Naše ingredience",
    "sk": "Naše ingrediencie",
    "ro": "Ingredientele noastre",
    "hu": "Összetevőink",
    "tr": "Malzemelerimiz",
    "ar": "مكوناتنا",
    "zh": "我们的成分",
    "ja": "私たちの成分",
    "ko": "우리 성분",
    "ru": "Наши ингредиенты",
    "uk": "Наші інгредієнти",
    "el": "Τα συστατικά μας",
}

_GENDER_LABELS = {
    "fr": {"homme": ("hommes", "homme"), "mixte": ("personnes", "personne"), "femme": ("femmes", "femme")},
    "en": {"homme": ("men", "man"), "mixte": ("people", "person"), "femme": ("women", "woman")},
    "de": {"homme": ("Männer", "Mann"), "mixte": ("Personen", "Person"), "femme": ("Frauen", "Frau")},
    "es": {"homme": ("hombres", "hombre"), "mixte": ("personas", "persona"), "femme": ("mujeres", "mujer")},
    "it": {"homme": ("uomini", "uomo"), "mixte": ("persone", "persona"), "femme": ("donne", "donna")},
    "pt": {"homme": ("homens", "homem"), "mixte": ("pessoas", "pessoa"), "femme": ("mulheres", "mulher")},
    "nl": {"homme": ("mannen", "man"), "mixte": ("mensen", "persoon"), "femme": ("vrouwen", "vrouw")},
    "da": {"homme": ("mænd", "mand"), "mixte": ("personer", "person"), "femme": ("kvinder", "kvinde")},
    "sv": {"homme": ("män", "man"), "mixte": ("personer", "person"), "femme": ("kvinnor", "kvinna")},
    "no": {"homme": ("menn", "mann"), "mixte": ("personer", "person"), "femme": ("kvinner", "kvinne")},
    "fi": {"homme": ("miestä", "mies"), "mixte": ("henkilöä", "henkilö"), "femme": ("naista", "nainen")},
    "pl": {"homme": ("mężczyzn", "mężczyzna"), "mixte": ("osób", "osoba"), "femme": ("kobiet", "kobieta")},
    "ru": {"homme": ("мужчин", "мужчина"), "mixte": ("человек", "человек"), "femme": ("женщин", "женщина")},
}

_SPECS_TITLE_FORMAT = {
    "fr": "Le [nom-court-du-produit] qu'il vous faut (OBLIGATOIRE : format 'Le X qu'il vous faut')",
    "en": "The [short-product-name] you need (REQUIRED format: 'The X you need')",
    "de": "Das [Kurzproduktname], das Sie brauchen (PFLICHTFORMAT: 'Das X, das Sie brauchen')",
    "es": "El [nombre-corto] que necesitas (FORMATO OBLIGATORIO: 'El X que necesitas')",
    "it": "Il [nome-breve] di cui hai bisogno (FORMATO OBBLIGATORIO: 'Il X di cui hai bisogno')",
    "pt": "O [nome-curto] que você precisa (FORMATO OBRIGATÓRIO: 'O X que você precisa')",
    "nl": "De [korte-productnaam] die je nodig hebt (VERPLICHT formaat: 'De X die je nodig hebt')",
    "da": "Den [korte-produktnavn] du har brug for (PÅKRÆVET format: 'Den X du har brug for')",
    "sv": "Den [korta-produktnamn] du behöver (OBLIGATORISKT format: 'Den X du behöver')",
    "no": "Den [korte-produktnavn] du trenger (PÅKREVD format: 'Den X du trenger')",
    "fi": "Se [lyhyt-tuotenimi], jonka tarvitset (PAKOLLINEN muoto: 'Se X, jonka tarvitset')",
    "pl": "Ten [krótka-nazwa-produktu], którego potrzebujesz (FORMAT OBOWIĄZKOWY: 'Ten X, którego potrzebujesz')",
    "ru": "Тот [краткое-название-продукта], который вам нужен (ОБЯЗАТЕЛЬНЫЙ формат: 'Тот X, который вам нужен')",
}


def build_product_page_prompt(context: dict) -> tuple[str, str]:
    """Prompt page produit — schéma identique à mock_generator.py / theme_modifier.py."""

    lang = context.get("language", "fr")
    lang2 = lang.lower()[:2]

    gender = context.get("target_gender", "femme")
    gender_map = _GENDER_LABELS.get(lang2, _GENDER_LABELS["fr"])
    gender_key = gender.lower() if gender.lower() in gender_map else "femme"
    plural_label, singular_label = gender_map[gender_key]

    ingredients_heading = _INGREDIENTS_HEADING.get(lang2, "Our ingredients")
    specs_title_format = _SPECS_TITLE_FORMAT.get(lang2, _SPECS_TITLE_FORMAT["en"])

    if lang2.startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation."
        quality_rule = "ABSOLUTE LANGUAGE QUALITY RULE: All generated texts must be written in perfect English — correct grammar, spelling, punctuation. Zero errors."
    elif lang2.startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß)."
        quality_rule = "ABSOLUTE LANGUAGE QUALITY RULE: All generated texts must be written in perfect German — correct grammar, all umlauts (ä, ö, ü, ß), capitalization of nouns. Zero errors."
    elif lang2.startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables."
        quality_rule = "RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés dans un français parfait et irréprochable : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords grammaticaux parfaits, orthographe sans faute."
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Do NOT write any French, English or any other language."
        quality_rule = f"ABSOLUTE LANGUAGE QUALITY RULE: ALL texts must be in the target language (ISO '{lang}'). Perfect grammar and spelling. Zero words in any other language."

    system = f"""Tu es un expert en copywriting e-commerce. Tu crées du contenu produit détaillé et convaincant.
Les champs "text" richtext utilisent du HTML (<p>, <strong>).
Les headings et short_titles sont du texte simple, sans HTML.
Les textes des mini_reviews sont du texte simple (pas de HTML).
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

{quality_rule}

RÈGLE GRAS OBLIGATOIRE : Dans TOUS les champs HTML (product_description.text, how_it_works.text, adoption.text), tu DOIS placer en <strong>...</strong> les expressions et mots d'impact — c'est-à-dire les mots forts, verbes d'action et tournures percutantes qui frappent l'esprit du lecteur. Chaque champ HTML doit contenir plusieurs <strong>.

RÈGLE INGRÉDIENTS : Si le produit est un produit naturel (savon, huile essentielle, sérum, cire, lotion, crème, gel, shampoing, beurre de karité, huile de soin, etc.) : dans le champ adoption, heading = '{ingredients_heading}' ET text = description HTML des ingrédients principaux avec leurs bénéfices. Sinon : heading = social proof chiffré + public, text = social proof.

RÈGLE LONGUEUR STRICTE : Tous les champs "text" sont COURTS. Maximum 2 phrases par paragraphe, maximum 2 paragraphes. Chaque phrase fait 10-15 mots MAX. PAS de longs textes.

RÈGLE AVANTAGES CONCRETS OBLIGATOIRE : TOUS les textes de la page produit doivent être CENTRÉS SUR CE QUE LE PRODUIT APPORTE AU CLIENT. Chaque champ doit exprimer un bénéfice concret, un résultat mesurable ou une transformation vécue. INTERDITS : descriptions techniques pures sans bénéfice, généralités vagues, promesses sans ancrage ("excellent", "de qualité"). OBLIGATOIRES pour product_benefits et product_specs : résultats chiffrés (ex: "-80% de douleur", "résultats en 14 jours", "+90% de satisfaction"), problèmes résolus (formulation avant/après), avantages exclusifs du produit. Chaque short_title et title de spec doit être un bénéfice direct pour le client, pas une caractéristique technique.

RÈGLE BÉNÉFICES PERCUTANTS OBLIGATOIRE : Les short_titles des product_benefits sont les accrocheurs les plus importants de la page — ils doivent CONVAINCRE et CONVERTIR. Chaque short_title doit :
- Être une phrase d'impact complète de 6 à 10 mots (PAS 3-4 mots, c'est trop court pour convaincre)
- Exprimer une transformation ou un résultat concret que le client va vivre
- Utiliser des formulations percutantes : "Résultats visibles en", "Peau lumineuse dès la", "Fini les problèmes de", "+90% des utilisateurs constatent"
- Être spécifique au domaine d'action réel du produit (beauté, santé, bien-être, etc.)
- INTERDITS : expressions trop courtes ("Éclat naturel", "Peau douce") — elles ne convainquent pas
- OBLIGATOIRES : formulations longues et précises qui donnent envie d'acheter immédiatement"""

    store = context["store_name"]
    product = context["product_names"][0] if context["product_names"] else "Produit"

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
    {{"short_title": "Phrase d'impact percutante 6-10 mots (résultat concret, ex: Résultats visibles dès la première utilisation)", "description": "1 phrase convaincante exprimant le bénéfice CONCRET pour le client — résultat, transformation ou chiffre clé"}},
    {{"short_title": "Bénéfice 2 : problème résolu ou transformation vécue (6-10 mots, formulation avant/après ou chiffre)", "description": "1 phrase avec chiffre ou preuve tangible"}},
    {{"short_title": "Bénéfice 3 : avantage exclusif du produit (6-10 mots, spécifique et différenciant)", "description": "1 phrase courte mais percutante"}},
    {{"short_title": "Bénéfice 4 : facilité, rapidité ou praticité (6-10 mots, ancré dans l'usage réel)", "description": "1 phrase courte qui rassure et donne envie"}},
    {{"short_title": "Bénéfice 5 : transformation émotionnelle ou sociale (6-10 mots, impact sur la vie du client)", "description": "1 phrase courte qui touche l'émotion"}}
  ],
  "product_description": {{
    "heading": "Description heading (plain text)",
    "text": "<p>2 short sentences with <strong>impact expression</strong>.</p><p>2 more short sentences with <strong>strong word</strong>.</p>"
  }},
  "how_it_works": {{
    "heading": "How it works heading (plain text)",
    "text": "<p>2 short sentences explaining the mechanism with <strong>impact words</strong>.</p><p>2 short sentences on benefits.</p>"
  }},
  "adoption": {{
    "heading": "RULE: If natural/ingredient-based product → write EXACTLY '{ingredients_heading}'. Otherwise → write '+XXXX {plural_label} [adopted it / ont adopté / haben es verwendet / …]' with a realistic and impactful number — IN THE TARGET LANGUAGE.",
    "text": "RULE: If natural product → '<p>List <strong>key ingredients</strong> with their specific benefits.</p><p>Short sentence on <strong>quality and origin</strong> of ingredients.</p>'. Otherwise → '<p>2 short social proof sentences with <strong>impactful expression</strong>.</p>'"
  }},
  "mini_reviews": [
    {{"name": "First name N. (consistent with {gender} audience)", "text": "Short review: 2 simple sentences, no HTML."}},
    {{"name": "First name N.", "text": "Different short review: 2 sentences."}},
    {{"name": "First name N.", "text": "Different short review: 2 sentences."}}
  ],
  "product_specs": {{
    "title": "{specs_title_format}",
    "items": [
      {{"title": "Product Advantage", "description": "Short 1-sentence description with <strong>strong word</strong>"}},
      {{"title": "Key Benefit", "description": "Short 1-sentence description with <strong>impact expression</strong>"}},
      {{"title": "Visible Result", "description": "Short 1-sentence description"}},
      {{"title": "Quality Guaranteed", "description": "Short 1-sentence description"}}
    ]
  }}
}}

CONTRAINTES :
- Exactement 5 product_benefits, 3 mini_reviews, 4 product_specs.items
- adoption.heading : '{ingredients_heading}' si produit naturel/ingrédient, sinon '+XXXX {plural_label} [adopted/ont adopté/…]' IN THE TARGET LANGUAGE
- Les short_titles doivent être PERCUTANTS et COMPLETS : 6 à 10 mots, résultat concret ou transformation — JAMAIS des expressions de 3-4 mots
- Les mini_reviews.text sont en texte simple (AUCUN HTML)
- Les champs HTML DOIVENT contenir plusieurs <strong> sur des expressions et mots d'impact
- product_specs.items[].title : EXACTEMENT 2 mots, representing a product advantage or benefit
- Tous les textes HTML : MAX 2 paragraphes de 2 phrases courtes chacun
- Témoignages : MAX 2 phrases courtes, texte simple
- Sois spécifique au produit, pas générique
- {lang_note}"""

    return system, user
