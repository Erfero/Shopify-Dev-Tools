def build_faq_prompt(context: dict) -> tuple[str, str]:
    """Prompt FAQ — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"faq": {"title": str, "items": [{"question": str, "answer": str}]}}
    """

    lang = context.get("language", "fr")
    lang2 = lang[:2].lower()

    # ── Language instruction (placed first so it overrides everything) ─────────
    _lang_map = {
        "fr": ("fr", "FRANÇAIS", "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables. Zero mot sans accent."),
        "en": ("en", "ENGLISH", "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation. Do NOT write any French."),
        "de": ("de", "GERMAN",  "Erstelle ALLE Texte auf DEUTSCH. Perfekte Grammatik, Rechtschreibung, alle Umlaute (ä, ö, ü, ß). Kein Französisch."),
        "da": ("da", "DANISH",  "Generer ALLE tekster på DANSK. Perfekt dansk grammatik og stavning. Brug alle danske tegn (æ, ø, å). Ingen fransk tekst."),
        "sv": ("sv", "SWEDISH", "Generera ALLA texter på SVENSKA. Perfekt svensk grammatik och stavning. Använd alla svenska tecken (å, ä, ö). Ingen franska."),
        "no": ("no", "NORWEGIAN", "Generer ALLE tekster på NORSK. Perfekt norsk grammatik og stavemåte. Ingen fransk tekst."),
        "fi": ("fi", "FINNISH", "Luo KAIKKI tekstit SUOMEKSI. Täydellinen suomen kielioppi ja oikeinkirjoitus. Ei ranskaa."),
        "es": ("es", "SPANISH", "Genera TODOS los textos en ESPAÑOL. Gramática y ortografía perfectas, todos los acentos (á, é, í, ó, ú, ñ, ü). Sin francés."),
        "pt": ("pt", "PORTUGUESE", "Gera TODOS os textos em PORTUGUÊS. Gramática e ortografia perfeitas, todos os acentos. Sem francês."),
        "it": ("it", "ITALIAN", "Genera TUTTI i testi in ITALIANO. Grammatica e ortografia perfette, tutti gli accenti. Niente francese."),
        "nl": ("nl", "DUTCH",   "Genereer ALLE teksten in het NEDERLANDS. Perfecte grammatica en spelling. Geen Frans."),
        "pl": ("pl", "POLISH",  "Generuj WSZYSTKIE teksty po POLSKU. Perfekcyjna gramatyka i pisownia, wszystkie znaki diakrytyczne. Bez francuskiego."),
        "ru": ("ru", "RUSSIAN", "Создавай ВСЕ тексты на РУССКОМ. Идеальная грамматика и орфография. Никакого французского."),
    }
    _code, _lang_name, lang_instruction = _lang_map.get(lang2, (
        lang2, lang.upper(),
        f"CRITICAL: Generate ALL texts in the language with ISO code '{lang}'. Perfect grammar, all required special characters. Do NOT write any French or English."
    ))

    # ── FAQ title translation ──────────────────────────────────────────────────
    _faq_titles = {
        "fr": "Questions Fréquentes",
        "en": "Frequently Asked Questions",
        "de": "Häufig gestellte Fragen",
        "da": "Ofte stillede spørgsmål",
        "sv": "Vanliga frågor",
        "no": "Vanlige spørsmål",
        "fi": "Usein kysytyt kysymykset",
        "es": "Preguntas Frecuentes",
        "pt": "Perguntas Frequentes",
        "it": "Domande Frequenti",
        "nl": "Veelgestelde vragen",
        "pl": "Często zadawane pytania",
        "ru": "Часто задаваемые вопросы",
    }
    faq_title = _faq_titles.get(lang2, "FAQ")

    # ── Example questions/answers per language ─────────────────────────────────
    _examples = {
        "fr": ("Ça marche vraiment ?", "Combien de temps pour voir des résultats ?"),
        "en": ("Does it really work?", "How long to see results?"),
        "de": ("Funktioniert das wirklich?", "Wie lange bis Ergebnisse sichtbar sind?"),
        "da": ("Virker det virkelig?", "Hvor lang tid før resultater?"),
        "sv": ("Fungerar det verkligen?", "Hur lång tid för att se resultat?"),
        "no": ("Fungerer det virkelig?", "Hvor lang tid før resultater?"),
        "fi": ("Toimiiko se oikeasti?", "Kuinka kauan tuloksiin menee?"),
        "es": ("¿Funciona de verdad?", "¿Cuánto tiempo para ver resultados?"),
        "pt": ("Funciona mesmo?", "Quanto tempo para ver resultados?"),
        "it": ("Funziona davvero?", "Quanto tempo per vedere i risultati?"),
        "nl": ("Werkt het echt?", "Hoe lang duurt het voor resultaten?"),
        "pl": ("Czy to naprawdę działa?", "Ile czasu zajmuje zobaczenie wyników?"),
        "ru": ("Это действительно работает?", "Сколько времени до результатов?"),
    }
    ex_q1, ex_q2 = _examples.get(lang2, ("Does it work?", "How long for results?"))

    system = f"""You are an expert e-commerce customer service specialist. You create relevant and detailed FAQs.

CRITICAL LANGUAGE RULE — ABSOLUTE PRIORITY: {lang_instruction}
Every single word in the output JSON must be in {_lang_name}. Questions, answers, title — ALL in {_lang_name}. This rule overrides everything else.

FORMAT RULES:
- Answers use richtext HTML (<p>, <strong>)
- Questions are plain text, no HTML
- Questions must be SHORT and natural: 5 to 10 words maximum
- Each answer must contain at least two <strong> tags around impactful words/phrases
- Respond ONLY with valid JSON, no surrounding text"""

    products = ", ".join(context["product_names"])
    product = context["product_names"][0] if context["product_names"] else "Product"

    user = f"""Store: {context['store_name']}
Product(s): {products}
{f"Description: {context['product_description']}" if context.get('product_description') else ""}

LANGUAGE: {_lang_name} — {lang_instruction}

Generate 5 frequently asked questions and answers for this product in {_lang_name}.
Each question must be 5 to 10 words maximum. Short, natural, direct.

Respond in JSON with this EXACT schema:

{{
  "faq": {{
    "title": "{faq_title}",
    "items": [
      {{
        "question": "{ex_q1}",
        "answer": "<p>Detailed answer with <strong>impactful expression</strong> and <strong>strong word</strong>.</p>"
      }},
      {{
        "question": "{ex_q2}",
        "answer": "<p>Detailed HTML answer with <strong>striking phrase</strong>.</p>"
      }},
      {{
        "question": "Short question 3 in {_lang_name}?",
        "answer": "<p>HTML answer with <strong>strong expression</strong>.</p>"
      }},
      {{
        "question": "Short question 4 in {_lang_name}?",
        "answer": "<p>HTML answer with <strong>action verb</strong>.</p>"
      }},
      {{
        "question": "Short question 5 in {_lang_name}?",
        "answer": "<p>HTML answer with <strong>impactful word</strong>.</p>"
      }}
    ]
  }}
}}

CONSTRAINTS:
- Exactly 5 items in faq.items
- ALL text MUST be in {_lang_name} — title, questions, answers
- The title must be exactly: "{faq_title}"
- Questions: plain text, NO HTML, 5 to 10 words each
- Answers: HTML with <p> and <strong> — at least two <strong> per answer
- Specific to product: {product}"""

    return system, user
