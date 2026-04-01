# Female first names per language (keyed by lowercased language name or ISO-2 prefix)
_PRENOMS_FEMININE: dict[str, str] = {
    "fr": "Marie P., Sophie L., Chloé M., Léa R., Manon D., Amélie B., Charlotte V., Emma T., Isabelle K., Pauline N.",
    "en": "Emma S., Olivia B., Sophia M., Isabella K., Ava T., Mia R., Charlotte L., Amelia W., Emily J., Grace C.",
    "de": "Lena M., Emma S., Hannah K., Mia B., Anna R., Leonie T., Laura N., Alina W., Sophie F., Johanna H.",
    "da": "Emma N., Sofie L., Laura M., Ida K., Maja B., Anna R., Freja T., Sara C., Emilie H., Julie P.",
    "es": "Sofía M., Isabella R., Valentina L., Camila B., Lucía T., Gabriela P., Sara N., Elena K., María C., Carmen F.",
    "it": "Sofia M., Emma L., Giulia R., Aurora B., Alice T., Ginevra N., Chiara K., Beatrice F., Martina P., Valentina C.",
    "nl": "Emma V., Olivia S., Mia B., Sophie M., Charlotte K., Tessa L., Luna R., Fleur N., Sara F., Laura H.",
    "pt": "Sofia M., Beatriz L., Maria R., Ana B., Inês T., Catarina N., Francisca K., Joana F., Rita P., Patrícia C.",
    "sv": "Emma N., Maja S., Elsa B., Alice L., Wilma K., Ebba R., Linnea T., Klara M., Molly F., Freja H.",
    "no": "Emma N., Nora S., Maja B., Sofia L., Emilie K., Sara R., Ingrid T., Frida M., Kaja F., Thea H.",
    "fi": "Emma N., Aino S., Sofia B., Helmi L., Maija K., Aada R., Siiri T., Lydia M., Anni F., Elina H.",
    "pl": "Julia N., Zuzanna S., Maja B., Zofia L., Natalia K., Aleksandra R., Wiktoria T., Amelia M., Oliwia F., Karolina H.",
    "cs": "Tereza N., Natalie S., Eliška B., Adéla L., Lucie K., Klára R., Karolína T., Veronika M., Jana F., Petra H.",
    "ro": "Maria N., Elena S., Ioana B., Andreea L., Alexandra K., Cristina R., Ana T., Diana M., Laura F., Mihaela H.",
    "hu": "Luca N., Anna S., Emma B., Zsófia L., Petra K., Veronika R., Katalin T., Nóra M., Ágnes F., Éva H.",
    "tr": "Ayşe N., Fatma S., Zeynep B., Elif L., Merve K., Büşra R., İrem T., Selin M., Deniz F., Aslı H.",
    "el": "Maria N., Eleni S., Katerina B., Sofia L., Anna K., Angeliki R., Vasiliki T., Dimitra M., Vicky F., Ioanna H.",
}

_PRENOMS_MASCULIN: dict[str, str] = {
    "fr": "Thomas P., Nicolas V., Antoine M., Julien R., Maxime D., Pierre B., Romain K., Alexandre T., David N., Florian C.",
    "en": "James S., Oliver B., Noah M., William K., Benjamin T., Lucas R., Henry L., Alexander W., Mason J., Ethan C.",
    "de": "Luca M., Noah S., Leon K., Jonas B., Felix R., Paul T., Elias N., Finn W., Max F., Lukas H.",
    "da": "Noah N., Lucas L., Emil M., Oliver K., William B., Magnus R., Frederik T., Victor C., Mikkel H., Rasmus P.",
    "es": "Santiago M., Mateo R., Sebastián L., Nicolás B., Alejandro T., Daniel P., Gabriel N., Lucas K., Diego C., Andrés F.",
    "it": "Lorenzo M., Leonardo L., Matteo R., Francesco B., Alessandro T., Andrea N., Davide K., Marco F., Riccardo P., Simone C.",
    "nl": "Liam V., Noah S., Oliver B., Lucas M., Finn K., Daan L., Sander R., Bram N., Joris F., Tim H.",
    "pt": "João M., Pedro L., Tiago R., Miguel B., Rodrigo T., Diogo N., Gonçalo K., André F., Nuno P., Rui C.",
    "sv": "Liam N., Noah S., Oliver B., Lucas L., Elias K., Hugo R., Axel T., Alexander M., Filip F., Erik H.",
    "no": "Oliver N., Noah S., William B., Elias L., Liam K., Lucas R., Filip T., Jakob M., Emil F., Isak H.",
    "fi": "Eetu N., Mikael S., Matias B., Aleksi L., Sami K., Jari R., Antti T., Timo M., Petri F., Markus H.",
    "pl": "Jakub N., Mateusz S., Michał B., Piotr L., Łukasz K., Marcin R., Tomasz T., Bartosz M., Dawid F., Filip H.",
    "cs": "Jakub N., Tomáš S., Jan B., Martin L., Lukáš K., Ondřej R., Petr T., Marek M., Jiří F., Pavel H.",
    "ro": "Alexandru N., Andrei S., Mihai B., Cristian L., Gabriel K., Bogdan R., Ionuț T., Daniel M., Vlad F., Radu H.",
    "hu": "Péter N., László S., János B., Gábor L., Attila K., Zoltán R., Tamás T., Balázs M., Ádám F., Bence H.",
    "tr": "Mehmet N., Mustafa S., Ahmet B., Ali L., Hasan K., Emre R., Burak T., Serkan M., Mert F., Cem H.",
    "el": "Giorgos N., Nikos S., Kostas B., Dimitris L., Stavros K., Vasilis R., Petros T., Antonis M., Ioannis F., Christos H.",
}


def _get_prenoms(lang_code: str, gender: str) -> str:
    """Return example reviewer names for the given language code and gender."""
    code = lang_code[:2].lower()
    if gender.lower() == "homme":
        return _PRENOMS_MASCULIN.get(code, _PRENOMS_MASCULIN["fr"])
    elif gender.lower() == "mixte":
        f_names = _PRENOMS_FEMININE.get(code, _PRENOMS_FEMININE["fr"]).split(", ")
        m_names = _PRENOMS_MASCULIN.get(code, _PRENOMS_MASCULIN["fr"]).split(", ")
        mixed = []
        for i in range(min(5, len(f_names), len(m_names))):
            mixed.append(f_names[i])
            mixed.append(m_names[i])
        return ", ".join(mixed[:10])
    else:
        return _PRENOMS_FEMININE.get(code, _PRENOMS_FEMININE["fr"])


def build_reviews_prompt(context: dict) -> tuple[str, str]:
    """Prompt avis clients — schéma identique à mock_generator.py / theme_modifier.py.

    Schema : {"reviews": [{"name", "age", "rating", "title", "text", "response"}]} x15
    """

    system = """Tu es un expert en marketing e-commerce. Tu génères des avis clients réalistes et variés.
Les textes des avis et des réponses sont en texte simple (AUCUN HTML).
Tu réponds UNIQUEMENT en JSON valide, sans texte autour.

RÈGLE QUALITÉ LINGUISTIQUE ABSOLUE : Tous les textes générés doivent être rédigés avec une orthographe et une grammaire parfaites dans la langue demandée. Pour le français : tous les accents obligatoires (é, è, ê, ë, à, â, ç, ù, û, î, ô, œ), conjugaison correcte, accords parfaits. Zéro mot écrit sans son accent. Cette règle est prioritaire sur toutes les autres."""

    products = ", ".join(context["product_names"])
    gender = context.get("target_gender", "femme")

    lang = context.get("language", "fr")
    if lang.lower().startswith("en"):
        lang_note = "Generate ALL texts in ENGLISH. Use perfect English grammar, spelling and punctuation. Use English first names."
        lang_code = "en"
    elif lang.lower().startswith("de"):
        lang_note = "Generate ALL texts in GERMAN. Use perfect German grammar, spelling, capitalization and all umlauts (ä, ö, ü, ß). Use German first names."
        lang_code = "de"
    elif lang.lower().startswith("fr"):
        lang_note = "Génère TOUS les textes en FRANÇAIS parfait. Tous les accents sont obligatoires : é, è, ê, ë, à, â, ç, ù, û, î, ô, œ. Conjugaison et grammaire irréprochables. Utilise des prénoms français."
        lang_code = "fr"
    elif lang.lower().startswith("da"):
        lang_note = "Generate ALL texts in DANISH. Use perfect Danish grammar and spelling. Use Danish first names."
        lang_code = "da"
    elif lang.lower().startswith("es"):
        lang_note = "Generate ALL texts in SPANISH. Use perfect Spanish grammar and spelling with all required accents. Use Spanish first names."
        lang_code = "es"
    elif lang.lower().startswith("it"):
        lang_note = "Generate ALL texts in ITALIAN. Use perfect Italian grammar and spelling. Use Italian first names."
        lang_code = "it"
    elif lang.lower().startswith("nl") or lang.lower().startswith("ne"):
        lang_note = "Generate ALL texts in DUTCH. Use perfect Dutch grammar and spelling. Use Dutch first names."
        lang_code = "nl"
    elif lang.lower().startswith("pt"):
        lang_note = "Generate ALL texts in PORTUGUESE. Use perfect Portuguese grammar, spelling and all required accents. Use Portuguese first names."
        lang_code = "pt"
    elif lang.lower().startswith("sv"):
        lang_note = "Generate ALL texts in SWEDISH. Use perfect Swedish grammar and spelling. Use Swedish first names."
        lang_code = "sv"
    elif lang.lower().startswith("no"):
        lang_note = "Generate ALL texts in NORWEGIAN. Use perfect Norwegian grammar and spelling. Use Norwegian first names."
        lang_code = "no"
    elif lang.lower().startswith("fi") or lang.lower().startswith("su"):
        lang_note = "Generate ALL texts in FINNISH. Use perfect Finnish grammar and spelling. Use Finnish first names."
        lang_code = "fi"
    elif lang.lower().startswith("pl"):
        lang_note = "Generate ALL texts in POLISH. Use perfect Polish grammar and spelling with all required special characters (ą, ę, ó, ś, ź, ż, ć, ń, ł). Use Polish first names."
        lang_code = "pl"
    else:
        lang_note = f"CRITICAL: Generate ALL texts in the language '{lang}'. Use perfect grammar, spelling and all required accents/special characters. Use first names that are authentic and common for that language/culture. Do NOT write any French text."
        lang_code = lang[:2].lower()

    prenoms_ex = _get_prenoms(lang_code, gender)

    if gender.lower() == "homme":
        gender_note = "Public masculin. Utilise majoritairement des prénoms masculins."
    elif gender.lower() == "mixte":
        gender_note = "Public mixte. Alterne prénoms masculins et féminins."
    else:
        gender_note = "Public féminin. Utilise majoritairement des prénoms féminins."

    image_note = """
IMPORTANT : Des images du produit sont jointes. Les avis doivent :
- Mentionner des détails visuels réels du produit que tu observes dans les images
- Paraître authentiques car ils décrivent le produit que les clients ont reçu
- Varier les références (packaging, produit en main, résultats visuels, etc.)
""" if context.get("has_images") else ""

    user = f"""Boutique : {context['store_name']}
Produit(s) : {products}
{f"Description : {context['product_description']}" if context.get('product_description') else ""}
{gender_note}
{lang_note}
{image_note}
Génère 15 avis clients authentiques et variés pour ce produit.

Réponds en JSON avec ce schéma EXACT :

{{
  "reviews": [
    {{
      "name": "Prénom N. (format Prénom Initiale.)",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre court de l'avis (texte simple)",
      "text": "Texte de l'avis (2-4 phrases authentiques, texte simple sans HTML)",
      "response": "Réponse chaleureuse de {context['store_name']} (1-2 phrases, texte simple)"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 2",
      "text": "Avis 2 différent (angle différent : efficacité, livraison, facilité...)",
      "response": "Réponse 2"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 3",
      "text": "Avis 3",
      "response": "Réponse 3"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 4",
      "text": "Avis 4",
      "response": "Réponse 4"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 5",
      "text": "Avis 5",
      "response": "Réponse 5"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 4,
      "title": "Titre 6 (rating 4, légèrement moins enthousiaste)",
      "text": "Avis 6 nuancé mais positif",
      "response": "Réponse 6"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 7",
      "text": "Avis 7",
      "response": "Réponse 7"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 8",
      "text": "Avis 8",
      "response": "Réponse 8"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 9",
      "text": "Avis 9",
      "response": "Réponse 9"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 10",
      "text": "Avis 10",
      "response": "Réponse 10"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 11",
      "text": "Avis 11",
      "response": "Réponse 11"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 4,
      "title": "Titre 12 (rating 4, nuancé mais positif)",
      "text": "Avis 12",
      "response": "Réponse 12"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 13",
      "text": "Avis 13",
      "response": "Réponse 13"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 14",
      "text": "Avis 14",
      "response": "Réponse 14"
    }},
    {{
      "name": "Prénom N.",
      "age": "XX ans",
      "rating": 5,
      "title": "Titre 15",
      "text": "Avis 15",
      "response": "Réponse 15"
    }}
  ]
}}

CONTRAINTES :
- Exactement 15 avis dans reviews[]
- Prénoms à utiliser (dans l'ordre) : {prenoms_ex}
- Âges entre 22 et 62 ans
- Les textes (text et response) sont en texte simple, AUCUN HTML
- Chaque avis doit être unique (angle différent : résultats, livraison, facilité, rapport qualité/prix...)
- Les réponses de la boutique sont courtes et chaleureuses (1-2 phrases)"""

    return system, user
