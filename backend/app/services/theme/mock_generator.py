"""Mock data generator — mirrors exactly what the AI prompts return.

Activated by USE_MOCK=true in .env. Produces realistic DermaLift-style
content parameterised by store_name / product / target_gender / language.

SCHEMA CONTRACT (shared with theme_modifier.py):
  homepage    → slogan, welcome, benefits[3], advantages[7], comparison, specs
  product_page→ product_benefits[5], product_description, how_it_works,
                adoption, mini_reviews[3]
  faq         → faq.title + faq.items[5]
  reviews     → reviews[10]
  global_texts→ header (timer+marquee — empty for FR, translated for EN/DE),
                footer (brand_text + conditionals)
  colors      → palettes[3]
  legal_pages → conditions_vente, mentions_legales, politique_expedition
  story_page  → page_heading, page_subheading, timeline_events[5]

ANNOUNCEMENT BAR POLICY:
  French   → announcement_timer="" and announcement_marquee="" (keep Story Theme defaults)
  English  → translated standard texts
  German   → translated standard texts
"""
import asyncio
import logging
from typing import AsyncGenerator

logger = logging.getLogger(__name__)


# ── Public API ────────────────────────────────────────────────────────────────

def _build_mock_data(
    store_name: str,
    store_email: str,
    product_names: list[str],
    product_description: str,
    language: str,
    target_gender: str = "femme",
    product_price: str | None = None,
    store_address: str | None = None,
    siret: str | None = None,
    delivery_delay: str = "3-5 jours ouvrés",
    return_policy_days: str = "30",
) -> dict[str, dict]:
    product = product_names[0] if product_names else "Produit Premium"
    lang = language.lower()

    if lang.startswith("en"):
        homepage_data     = _mock_homepage_en(store_name, product, target_gender)
        product_data      = _mock_product_page_en(store_name, product, target_gender)
        faq_data          = _mock_faq_en(store_name, product)
        reviews_data      = _mock_reviews_en(store_name, product, target_gender)
        story_data        = _mock_story_page_en(store_name, product)
        legal_data        = _mock_legal_pages_en(
            store_name, store_email, product, product_price,
            store_address, siret, delivery_delay, return_policy_days,
        )
    elif lang.startswith("de"):
        homepage_data     = _mock_homepage_de(store_name, product, target_gender)
        product_data      = _mock_product_page_de(store_name, product, target_gender)
        faq_data          = _mock_faq_de(store_name, product)
        reviews_data      = _mock_reviews_de(store_name, product, target_gender)
        story_data        = _mock_story_page_de(store_name, product)
        legal_data        = _mock_legal_pages_de(
            store_name, store_email, product, product_price,
            store_address, siret, delivery_delay, return_policy_days,
        )
    else:  # French (default)
        homepage_data     = _mock_homepage(store_name, product, target_gender)
        product_data      = _mock_product_page(store_name, product, target_gender)
        faq_data          = _mock_faq(store_name, product)
        reviews_data      = _mock_reviews(store_name, product, target_gender)
        story_data        = _mock_story_page(store_name, product)
        legal_data        = _mock_legal_pages(
            store_name, store_email, product, product_price,
            store_address, siret, delivery_delay, return_policy_days,
        )

    return {
        "colors":       _mock_colors(store_name, lang),
        "homepage":     homepage_data,
        "product_page": product_data,
        "reviews":      reviews_data,
        "faq":          faq_data,
        "story_page":   story_data,
        "global_texts": _mock_global_texts(store_name, product, target_gender, lang),
    }


async def generate_mock_texts(
    store_name: str,
    store_email: str,
    product_names: list[str],
    product_description: str | None = None,
    language: str = "fr",
    image_paths=None,
    target_gender: str = "femme",
    product_price: str | None = None,
    store_address: str | None = None,
    siret: str | None = None,
    delivery_delay: str = "3-5 jours ouvrés",
    return_policy_days: str = "30",
    marketing_angles: str | None = None,
) -> AsyncGenerator[tuple[str, str, dict | None], None]:
    """Yield (step_id, status, data) tuples — same interface as generate_all_texts."""
    all_mock = _build_mock_data(
        store_name, store_email, product_names,
        product_description or "", language,
        target_gender, product_price, store_address,
        siret, delivery_delay, return_policy_days,
    )

    steps = [
        "colors", "homepage", "product_page", "reviews",
        "faq", "story_page", "global_texts",
    ]
    all_results = {}

    for step_id in steps:
        yield (step_id, "generating", None)
        await asyncio.sleep(0.3)
        data = all_mock[step_id]
        all_results[step_id] = data
        logger.info("[MOCK] Step %s done", step_id)
        yield (step_id, "done", data)

    yield ("complete", "done", all_results)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _pronoun(target_gender: str) -> tuple[str, str, str]:
    """Return (singular_subject, plural_subject, plural_past_adj)."""
    g = target_gender.lower()
    if g == "homme":
        return "il", "ils", "adoptés"
    if g == "mixte":
        return "il/elle", "ils/elles", "adopté(e)s"
    return "elle", "elles", "adoptées"   # default: femme


def _gender_suffix(target_gender: str) -> str:
    g = target_gender.lower()
    if g == "homme":
        return "s"
    if g == "mixte":
        return "(e)s"
    return "s"


# ── Colors ────────────────────────────────────────────────────────────────────

def _mock_colors(store_name: str, lang: str = "fr") -> dict:
    if lang.startswith("en"):
        names = [
            (f"{store_name} — Rose Elegance", "Soft palette with premium rosy and beige tones"),
            (f"{store_name} — Minimalist White", "Clean palette in black and white with a golden touch"),
            (f"{store_name} — Natural Luxury", "Natural tones, terracotta and cream"),
        ]
    elif lang.startswith("de"):
        names = [
            (f"{store_name} — Rosé-Eleganz", "Sanfte Palette in roséfarbenen und beigefarbenen Premiumtönen"),
            (f"{store_name} — Minimalistisches Weiß", "Klare schwarz-weiße Palette mit goldenem Akzent"),
            (f"{store_name} — Natürlicher Luxus", "Natürliche Töne, Terrakotta und Creme"),
        ]
    else:
        names = [
            (f"{store_name} — Élégance Rose", "Palette douce aux tons rosés et beiges premium"),
            (f"{store_name} — Minimaliste Blanc", "Palette épurée blanc et noir avec touche dorée"),
            (f"{store_name} — Naturel Luxe", "Palette aux tons naturels, terracotta et crème"),
        ]

    return {
        "palettes": [
            {
                "name": names[0][0],
                "description": names[0][1],
                "colors": {
                    "background": "#FFF8F6",
                    "background_secondary": "#F5E8E4",
                    "text": "#1A1A1A",
                    "text_secondary": "#6B5E5A",
                    "accent1": "#C96A6A",
                    "accent2": "#2C2C2C",
                },
            },
            {
                "name": names[1][0],
                "description": names[1][1],
                "colors": {
                    "background": "#FFFFFF",
                    "background_secondary": "#F9F6F0",
                    "text": "#111111",
                    "text_secondary": "#777777",
                    "accent1": "#B8956A",
                    "accent2": "#222222",
                },
            },
            {
                "name": names[2][0],
                "description": names[2][1],
                "colors": {
                    "background": "#FDF9F4",
                    "background_secondary": "#EDE3D8",
                    "text": "#2D2520",
                    "text_secondary": "#7A6E68",
                    "accent1": "#C07A55",
                    "accent2": "#3D3330",
                },
            },
        ]
    }


# ══════════════════════════════════════════════════════════════════════════════
#  FRENCH MOCK DATA
# ══════════════════════════════════════════════════════════════════════════════

def _mock_homepage(store_name: str, product: str, target_gender: str) -> dict:
    _, pronoun_pl, _ = _pronoun(target_gender)

    return {
        "slogan": (
            f"{store_name} : Redéfinissez Votre Ovale, Révélez Votre Confiance."
        ),
        "welcome": {
            "title": f"Bienvenue chez {store_name}",
            "text": (
                f"<p>Nous sommes enchantés de vous accueillir chez "
                f"<strong>{store_name}</strong>, votre destination pour transformer "
                f"l'ovale de votre visage et retrouver une confiance radieuse grâce "
                f"à notre <strong>{product}</strong> révolutionnaire.</p>"
            ),
        },
        "benefits": [
            {
                "title": "Ovale du Visage Redéfini",
                "text": "Sculpte et affine les contours du menton et de la mâchoire.",
            },
            {
                "title": "Peau Ferme et Lisse",
                "text": "Effet tenseur immédiat pour une peau visiblement plus jeune.",
            },
            {
                "title": "Confiance Retrouvée",
                "text": "Boostez votre estime de soi avec un profil sublimé.",
            },
        ],
        "advantages": [
            {
                "title": "Sculptez un Ovale Parfait en Seulement 3 Semaines",
                "text": (
                    f"<p>Notre <strong>{product}</strong> cible efficacement le "
                    "double-menton, redessinant les contours de votre visage. "
                    "Obtenez une mâchoire plus définie et harmonieuse sans effort.</p>"
                ),
            },
            {
                "title": "Offrez un Lifting Visible Dès la Première Application",
                "text": (
                    "<p>Ressentez un <strong>effet tenseur immédiat</strong> qui lisse "
                    "et raffermit votre peau. Profitez d'une peau plus tonique et "
                    "élastique jour après jour.</p>"
                ),
            },
            {
                "title": "Retrouvez une Jeunesse Éclatante, Naturellement",
                "text": (
                    "<p>Notre <strong>formule avancée</strong> estompe les signes de "
                    "l'âge et revitalise votre peau. Révélez un cou et un menton "
                    "visiblement plus jeunes et dynamiques.</p>"
                ),
            },
            {
                "title": "Adoptez un Rituel Beauté Simple et Efficace à Domicile",
                "text": (
                    "<p>Intégrez facilement ce <strong>soin expert</strong> à votre "
                    "routine, sans contraintes de temps. Profitez d'un moment de détente "
                    "pour des résultats professionnels chez vous.</p>"
                ),
            },
            {
                "title": "Rayonnez de Confiance avec un Profil Sublimé",
                "text": (
                    "<p>Un ovale du visage affiné et une peau ferme "
                    "<strong>boostent votre estime de soi</strong>. Affichez votre "
                    "beauté avec assurance et élégance en toutes circonstances.</p>"
                ),
            },
            {
                "title": "Hydratation Intense pour une Peau Repulpée",
                "text": (
                    "<p>Enrichi en <strong>actifs hydratants</strong>, notre masque "
                    "nourrit profondément l'épiderme. Votre peau est douce, souple et "
                    "visiblement repulpée.</p>"
                ),
            },
            {
                "title": "Une Solution Non-Invasive et Confortable",
                "text": (
                    f"<p>Dites adieu aux méthodes invasives et inconfortables. "
                    f"<strong>{store_name}</strong> offre une alternative douce et "
                    "efficace pour un résultat naturel et durable.</p>"
                ),
            },
        ],
        "comparison": {
            "title": f"Pourquoi choisir {store_name} ?",
            "description": (
                f"Découvrez pourquoi nos client{_gender_suffix(target_gender)} "
                f"sont accros à notre {product}."
            ),
            "items": [
                {
                    "feature": "Ciblage Précis",
                    "tooltip": (
                        "Formule spécifiquement conçue pour redéfinir l'ovale du visage "
                        "et réduire le double-menton."
                    ),
                },
                {
                    "feature": "Effet Liftant Durable",
                    "tooltip": (
                        "Offre un effet tenseur immédiat et un raffermissement "
                        "progressif et durable."
                    ),
                },
                {
                    "feature": "Formule Avancée",
                    "tooltip": (
                        "Riche en actifs puissants (collagène, acide hyaluronique) "
                        "pour une action en profondeur."
                    ),
                },
                {
                    "feature": "Confort Optimal",
                    "tooltip": (
                        "Adhérence parfaite, texture agréable et non-irritante pour "
                        "une expérience de soin relaxante."
                    ),
                },
                {
                    "feature": "Résultats Visibles",
                    "tooltip": (
                        "Ovale du visage visiblement affiné, peau plus ferme, "
                        "lisse et rajeunie."
                    ),
                },
            ],
        },
        "specs": {
            "title": f"{store_name} : Votre Allié Beauté Incontournable",
            "items": [
                {
                    "title": "Ovale Redessiné",
                    "description": "Cible précisément le double-menton pour un profil affiné.",
                },
                {
                    "title": "Lifting Express",
                    "description": "Effet tenseur visible dès la première pose.",
                },
                {
                    "title": "Peau Raffermie",
                    "description": "Améliore l'élasticité pour une fermeté durable.",
                },
                {
                    "title": "Confort Absolu",
                    "description": "Application agréable et non-irritante, sans glisser.",
                },
            ],
        },
        "cta_button_text": "",
    }


def _mock_product_page(store_name: str, product: str, target_gender: str) -> dict:
    _, _, past_adj = _pronoun(target_gender)
    pronoun_pl_label = "femmes" if target_gender.lower() != "homme" else "hommes"

    return {
        "product_benefits": [
            {
                "short_title": "Redéfinit l'Ovale du Visage",
                "description": "Sculpte et affine les contours du menton et de la mâchoire.",
            },
            {
                "short_title": "Effet Liftant Immédiat",
                "description": "Offre une sensation de fermeté et de tension dès la première application.",
            },
            {
                "short_title": "Réduit le Double-Menton",
                "description": "Aide à diminuer l'apparence du double-menton avec une utilisation régulière.",
            },
            {
                "short_title": "Améliore l'Élasticité Cutanée",
                "description": "Rend la peau plus tonique et souple, combattant le relâchement.",
            },
            {
                "short_title": "Hydratation Profonde",
                "description": "Nourrit intensément la peau pour un aspect lisse et repulpé.",
            },
        ],
        "product_description": {
            "heading": "Description",
            "text": (
                f"<p><strong>{store_name}</strong> : Révélez la Beauté de Votre Ovale du Visage</p>"
                f"<p>Le <strong>{product}</strong> est bien plus qu'un simple soin ; c'est une "
                "révolution pour celles qui rêvent d'un ovale du visage parfaitement dessiné et "
                "d'une confiance inébranlable. Conçu avec l'excellence de la cosmétique française, "
                "notre masque est la solution <strong>non-invasive et ultra-efficace</strong> pour "
                "cibler le double-menton et le relâchement cutané.</p>"
                "<p>Au cœur de l'efficacité réside notre technologie hydrogel innovante. Cette "
                "matrice unique adhère parfaitement aux contours de votre visage, optimisant la "
                "pénétration des actifs : <strong>Collagène Marin Hydrolysé</strong>, "
                "<strong>Acide Hyaluronique de Bas Poids Moléculaire</strong>, extraits de plantes "
                f"raffermissantes (Caféine, Gingembre) et <strong>Vitamine E</strong> antioxydante.</p>"
                f"<p>Rejoignez les milliers de {pronoun_pl_label} qui ont déjà adopté le secret "
                f"d'une beauté intemporelle avec {store_name}.</p>"
            ),
        },
        "how_it_works": {
            "heading": "Comment ça marche ?",
            "text": (
                f"<p>Le <strong>{product}</strong> utilise une synergie parfaite entre une "
                "technologie hydrogel innovante et des actifs puissants. Une fois appliqué, "
                "le masque épouse les contours de votre menton. La chaleur de votre corps "
                "active le gel, libérant progressivement les ingrédients actifs.</p>"
                "<p><strong>Effet Tenseur Immédiat :</strong> Des polymères créent un film "
                "invisible qui lifte et raffermit instantanément la peau.</p>"
                "<p><strong>Stimulation et Drainage :</strong> Des extraits végétaux favorisent "
                "la microcirculation et le drainage lymphatique.</p>"
                "<p><strong>Raffermissement Durable :</strong> Le collagène et l'acide hyaluronique "
                "stimulent la production naturelle de fibres de soutien.</p>"
                "<p>Laissez agir 30 à 60 minutes, 3 à 5 fois par semaine. Pas besoin de rincer.</p>"
            ),
        },
        "adoption": {
            "heading": f"+9860 {pronoun_pl_label} l'ont adopté",
            "text": (
                f"<p>Elles ont toutes fait le choix de <strong>{store_name}</strong> pour "
                "transformer l'ovale de leur visage et retrouver une confiance éclatante. "
                "Rejoignez notre communauté grandissante qui a découvert le secret d'un profil "
                "sublimé, sans chirurgie ni contraintes.</p>"
                "<p>Leurs témoignages unanimes saluent l'<strong>efficacité prouvée</strong>, "
                "la facilité d'utilisation et les résultats visibles et durables.</p>"
            ),
        },
        "mini_reviews": [
            {
                "name": "Marie P.",
                "age": "22 ans",
                "text": (
                    "J'étais très complexée par mon double-menton, même à mon jeune âge. "
                    f"J'ai testé le {product} par curiosité et je suis bluffée ! Après "
                    "seulement quelques semaines, mon ovale est plus net et ma mâchoire "
                    "plus définie. La livraison a été super rapide en plus, je recommande à 100% !"
                ),
            },
            {
                "name": "Sophie L.",
                "age": "45 ans",
                "text": (
                    "Avec l'âge, j'avais l'impression que mon cou perdait de sa fermeté. "
                    "Ce masque est une vraie révolution ! L'effet liftant est immédiat et "
                    "ma peau est visiblement plus tonique. C'est devenu mon petit rituel "
                    "beauté du soir, un vrai moment de détente pour des résultats incroyables."
                ),
            },
            {
                "name": "Chloé M.",
                "age": "30 ans",
                "text": (
                    "J'ai toujours été sceptique face aux produits « miracles », mais "
                    f"{store_name} a changé ma perception. Mon double-menton est moins "
                    "prononcé et je me sens beaucoup plus à l'aise pour prendre des photos. "
                    "Le service client est également très réactif, un grand merci !"
                ),
            },
        ],
        "section_headings": {
            "marquee": "",
            "ugc": "",
            "product_tagline": "",
            "delivery_promo": "",
            "buy_button": "",
        },
        "delivery_info": {
            "heading": "",
            "text": "",
            "today_label": "",
            "ready_label": "",
            "delivered_label": "",
        },
    }


def _mock_faq(store_name: str, product: str) -> dict:
    return {
        "faq": {
            "title": "Questions Fréquentes",
            "items": [
                {
                    "question": f"Comment fonctionne le {product} pour réduire le double-menton ?",
                    "answer": (
                        "<p>Notre masque utilise une technologie avancée d'hydrogel imprégné "
                        "d'actifs puissants comme le <strong>collagène</strong>, l'acide "
                        "hyaluronique et des extraits végétaux. Ces ingrédients agissent en "
                        "synergie pour stimuler la microcirculation, favoriser le drainage et "
                        "offrir un effet tenseur qui aide à remodeler l'ovale du visage.</p>"
                    ),
                },
                {
                    "question": "À quelle fréquence dois-je utiliser le masque pour voir des résultats ?",
                    "answer": (
                        "<p>Pour des résultats optimaux, nous recommandons d'utiliser le masque "
                        f"<strong>{store_name}</strong> 3 à 5 fois par semaine, pendant "
                        "<strong>30 à 60 minutes</strong> par séance. De nombreuses utilisatrices "
                        "constatent une amélioration visible dès les premières semaines.</p>"
                    ),
                },
                {
                    "question": f"Le {product} est-il adapté à tous les types de peau ?",
                    "answer": (
                        "<p>Oui, notre formule a été développée pour être douce et "
                        "<strong>hypoallergénique</strong>, convenant ainsi à tous les types "
                        "de peau, même les plus sensibles. Il est testé dermatologiquement.</p>"
                    ),
                },
                {
                    "question": f"Puis-je réutiliser le {product} ?",
                    "answer": (
                        f"<p>Non, le <strong>{product}</strong> est conçu pour un usage unique. "
                        "Chaque masque est imprégné d'une dose optimale d'ingrédients actifs "
                        "libérés lors de l'application. Utilisez un nouveau masque à chaque séance.</p>"
                    ),
                },
                {
                    "question": f"Quels sont les ingrédients clés du {product} ?",
                    "answer": (
                        "<p>Notre masque est formulé avec des ingrédients de haute qualité : "
                        "<strong>acide hyaluronique</strong> pour une hydratation profonde, "
                        "<strong>collagène</strong> pour améliorer l'élasticité de la peau, et "
                        "des <strong>extraits de plantes</strong> raffermissants et antioxydants.</p>"
                    ),
                },
            ],
        }
    }


def _mock_reviews(store_name: str, product: str, target_gender: str) -> dict:
    g = target_gender.lower()
    if g == "homme":
        names = [
            ("Thomas P.", "32 ans"), ("Nicolas V.", "41 ans"),
            ("Antoine M.", "28 ans"), ("Julien R.", "55 ans"),
            ("Maxime D.", "37 ans"), ("Pierre B.", "48 ans"),
            ("Romain K.", "25 ans"), ("Alexandre T.", "62 ans"),
            ("David N.", "33 ans"), ("Florian C.", "44 ans"),
        ]
    else:
        names = [
            ("Marie P.", "22 ans"), ("Sophie L.", "45 ans"),
            ("Chloé M.", "30 ans"), ("Léa R.", "58 ans"),
            ("Manon D.", "35 ans"), ("Amélie B.", "28 ans"),
            ("Charlotte V.", "42 ans"), ("Emma T.", "52 ans"),
            ("Isabelle K.", "38 ans"), ("Pauline N.", "25 ans"),
        ]

    review_data = [
        {
            "title": "Bluffée par les résultats !",
            "text": (
                f"J'étais très complexée par mon double-menton, même à mon jeune âge. "
                f"J'ai testé le {product} par curiosité et je suis bluffée ! Après "
                "seulement quelques semaines, mon ovale est plus net et ma mâchoire "
                "plus définie. La livraison a été super rapide, je recommande à 100% !"
            ),
            "response": (
                f"Nous sommes ravies d'apprendre que notre {product} vous apporte "
                "tant de satisfaction ! Votre confiance est notre plus belle récompense."
            ),
        },
        {
            "title": "Une vraie révolution beauté !",
            "text": (
                "Avec l'âge, j'avais l'impression que mon cou perdait de sa fermeté. "
                "Ce masque est une vraie révolution ! L'effet liftant est immédiat et "
                "ma peau est visiblement plus tonique. C'est devenu mon rituel beauté du soir."
            ),
            "response": (
                f"Quel plaisir de lire votre retour ! Nous sommes enchantés que "
                f"{store_name} s'intègre parfaitement à votre routine."
            ),
        },
        {
            "title": "Un produit qui tient ses promesses",
            "text": (
                "J'ai toujours été sceptique face aux produits miracles, mais "
                f"{store_name} a changé ma perception. Mon double-menton est moins "
                "prononcé et je me sens beaucoup plus à l'aise pour prendre des photos."
            ),
            "response": (
                "Votre témoignage nous touche particulièrement ! Nous sommes fiers "
                f"de vous avoir prouvé l'efficacité de nos produits."
            ),
        },
        {
            "title": "Livraison rapide, résultats au rendez-vous !",
            "text": (
                "J'ai reçu mon masque en un temps record ! L'application est facile et "
                "agréable, et je sens ma peau vraiment plus ferme après chaque utilisation."
            ),
            "response": (
                "Nous sommes ravis que la rapidité de notre livraison et l'efficacité "
                "de notre masque vous aient enchantée ! Merci pour votre confiance !"
            ),
        },
        {
            "title": "Confortable et efficace",
            "text": (
                "Le masque est très confortable à porter et ne glisse pas. "
                "J'ai remarqué une nette amélioration de l'élasticité de ma peau."
            ),
            "response": (
                "Nous sommes très heureux que le confort et les résultats de notre masque "
                "vous plaisent ! Votre fidélité est précieuse."
            ),
        },
        {
            "title": "Mon ovale s'est visiblement affiné",
            "text": (
                f"Après 3 semaines d'utilisation régulière du {product}, je suis stupéfaite "
                "du résultat. Mon ovale s'est visiblement affiné et ma peau est bien plus ferme."
            ),
            "response": (
                f"Merci pour ce magnifique témoignage ! Chez {store_name}, nous croyons "
                "en la puissance des soins innovants pour révéler la beauté naturelle."
            ),
        },
        {
            "title": "Le lifting à domicile, ça marche !",
            "text": (
                "Je cherchais une alternative non-invasive aux soins esthétiques coûteux. "
                f"Le {product} est LA solution ! Dès la première utilisation, j'ai ressenti "
                "un effet tenseur remarquable."
            ),
            "response": (
                "Votre satisfaction est notre plus grande fierté ! Nous sommes enchantés "
                "que notre masque vous offre les résultats d'un soin professionnel à domicile."
            ),
        },
        {
            "title": "Peau raffermie et rajeunie",
            "text": (
                "À 52 ans, j'avais perdu espoir de voir mon double-menton s'atténuer. "
                f"Le {product} m'a prouvé que c'était possible ! Ma peau est bien plus ferme."
            ),
            "response": (
                "Ce témoignage nous touche profondément ! Notre mission est d'aider "
                "chaque femme à se sentir belle et confiante à tout âge."
            ),
        },
        {
            "title": "Satisfaite à 200% !",
            "text": (
                f"Je suis une habituée des soins beauté et le {product} se distingue "
                "vraiment par sa qualité. La texture du masque est agréable, il adhère "
                "parfaitement et les résultats sont au rendez-vous."
            ),
            "response": (
                f"Merci pour cette évaluation enthousiaste ! Nous sommes ravis que notre "
                f"{product} réponde à vos exigences."
            ),
        },
        {
            "title": "Résultats rapides et durables",
            "text": (
                "Ce que j'aime particulièrement avec ce masque, c'est que les résultats "
                "sont à la fois rapides et durables. Mon ovale est vraiment plus défini."
            ),
            "response": (
                f"C'est exactement l'effet que nous voulons produire avec {store_name} ! "
                "Des résultats immédiats qui s'améliorent avec le temps."
            ),
        },
    ]

    reviews = []
    for i, (name_age, rev_data) in enumerate(zip(names, review_data)):
        name, age = name_age
        reviews.append({
            "name": name,
            "age": age,
            "rating": 5 if i % 5 != 4 else 4,
            "title": rev_data["title"],
            "text": rev_data["text"],
            "response": rev_data["response"],
        })

    return {"reviews": reviews}


def _mock_legal_pages(
    store_name: str,
    store_email: str,
    product: str,
    product_price: str | None,
    store_address: str | None,
    siret: str | None,
    delivery_delay: str,
    return_policy_days: str,
) -> dict:
    price_str = f"{product_price} €" if product_price else "selon tarif en vigueur"
    address_str = store_address or "Adresse disponible sur demande"
    siret_str = siret or "En cours d'enregistrement"

    return {
        "conditions_vente": {
            "title": "Conditions Générales de Vente",
            "content": (
                f"<h2>Conditions Générales de Vente — {store_name}</h2>"
                "<h3>Article 1 : Objet</h3>"
                f"<p>Les présentes CGV régissent les ventes de produits proposés par "
                f"<strong>{store_name}</strong> sur sa boutique en ligne.</p>"
                "<h3>Article 2 : Prix</h3>"
                f"<p>Les prix sont indiqués en euros TTC. Le {product} est disponible "
                f"à partir de <strong>{price_str}</strong>.</p>"
                "<h3>Article 3 : Livraison</h3>"
                f"<p>Expédition sous 24-48h ouvrées. Délai : "
                f"<strong>{delivery_delay}</strong>.</p>"
                "<h3>Article 4 : Droit de Rétractation</h3>"
                f"<p>Vous disposez de <strong>{return_policy_days} jours</strong> "
                "à compter de la réception pour retourner votre article.</p>"
                "<h3>Article 5 : Contact</h3>"
                f"<p>Email : <a href=\"mailto:{store_email}\">{store_email}</a></p>"
            ),
        },
        "mentions_legales": {
            "title": "Mentions Légales",
            "content": (
                f"<h2>Mentions Légales — {store_name}</h2>"
                "<h3>Éditeur du site</h3>"
                f"<p><strong>{store_name}</strong></p>"
                f"<p>Adresse : {address_str}</p>"
                f"<p>Email : <a href=\"mailto:{store_email}\">{store_email}</a></p>"
                f"<p>SIRET : {siret_str}</p>"
                "<h3>Hébergement</h3>"
                "<p>Shopify Inc. — 150 Elgin St, Ottawa, ON K2P 1L4, Canada</p>"
                "<h3>Données personnelles</h3>"
                "<p>Conformément au RGPD, vous disposez d'un droit d'accès, de "
                "rectification et de suppression de vos données. Contactez-nous à "
                f"<a href=\"mailto:{store_email}\">{store_email}</a>.</p>"
            ),
        },
        "politique_expedition": {
            "title": "Politique d'Expédition",
            "content": (
                f"<h2>Politique d'Expédition — {store_name}</h2>"
                "<h3>Délais de traitement</h3>"
                "<p>Les commandes sont traitées sous <strong>24-48h ouvrées</strong>.</p>"
                "<h3>Délais estimés</h3>"
                "<ul>"
                f"<li><strong>France métropolitaine :</strong> {delivery_delay}</li>"
                "<li><strong>Belgique, Suisse, Luxembourg :</strong> 5-10 jours ouvrés</li>"
                "<li><strong>Europe :</strong> 7-14 jours ouvrés</li>"
                "</ul>"
                "<h3>Retours</h3>"
                f"<p>Retours acceptés sous <strong>{return_policy_days} jours</strong>.</p>"
                "<h3>Contact</h3>"
                f"<p><a href=\"mailto:{store_email}\">{store_email}</a></p>"
            ),
        },
    }


def _mock_story_page(store_name: str, product: str) -> dict:
    return {
        "page_heading": f"L'Histoire de {store_name}",
        "page_subheading": (
            f"De la passion pour la beauté à l'innovation, "
            "découvrez notre parcours vers l'excellence."
        ),
        "timeline_events": [
            {
                "year": "2020",
                "heading": "La naissance d'une idée",
                "text": (
                    f"L'aventure {store_name} commence avec une idée simple : "
                    "permettre à chaque personne de retrouver confiance en son apparence "
                    "grâce à des solutions innovantes et accessibles."
                ),
            },
            {
                "year": "2021",
                "heading": "Le développement du produit",
                "text": (
                    f"Après des mois de recherche avec des dermatologues, "
                    f"notre {product} est mis au point. La formule enrichie en "
                    "actifs premium est finalisée pour des résultats visibles dès "
                    "la première application."
                ),
            },
            {
                "year": "2022",
                "heading": "Le lancement officiel",
                "text": (
                    f"Nous lançons officiellement {store_name}. L'accueil est "
                    "au-delà de nos espérances : des milliers de commandes dès "
                    "les premières semaines et des témoignages enthousiastes."
                ),
            },
            {
                "year": "2023",
                "heading": "La communauté grandissante",
                "text": (
                    "Notre communauté dépasse les 10 000 clients satisfaits. "
                    f"{store_name} devient la référence dans son domaine en France."
                ),
            },
            {
                "year": "2024",
                "heading": "L'avenir et l'innovation",
                "text": (
                    "Forts de notre expérience et des retours de notre communauté, "
                    "nous continuons d'innover. Notre mission reste la même : "
                    "révéler la beauté naturelle de chacun avec des solutions durables."
                ),
            },
        ],
    }


def _mock_global_texts(
    store_name: str,
    product: str,
    target_gender: str,
    language: str,
) -> dict:
    """Header: announcement bar texts.
    FR → empty strings (keep Story Theme defaults unchanged).
    EN/DE → translated standard texts.
    Footer: brand_text always updated; badges/newsletter only for non-FR.
    """
    lang = language.lower()
    is_fr = lang.startswith("fr")
    is_en = lang.startswith("en")

    # ── Header ──────────────────────────────────────────────────────────────
    if is_fr:
        # Keep Story Theme defaults — do not replace
        header = {"announcement_timer": "", "announcement_marquee": ""}
    elif is_en:
        header = {
            "announcement_timer": "SPECIAL OFFER: Free shipping on all orders!",
            "announcement_marquee": "FREE SHIPPING | RESULTS GUARANTEED | SECURE PAYMENT",
        }
    else:  # DE
        header = {
            "announcement_timer": "SONDERANGEBOT: Kostenloser Versand auf alle Bestellungen!",
            "announcement_marquee": "GRATIS VERSAND | ERGEBNISSE GARANTIERT | SICHERE ZAHLUNG",
        }

    # ── Footer ───────────────────────────────────────────────────────────────
    if is_fr:
        footer: dict = {
            "brand_text": (
                f"<p><strong>{store_name}</strong> est votre partenaire dédié à la beauté, "
                "offrant des solutions innovantes pour sublimer votre apparence et "
                "révéler votre éclat naturel avec confiance.</p>"
            ),
            "trust_badges": [],
            "newsletter_heading": "",
            "newsletter_text": "",
        }
    elif is_en:
        footer = {
            "brand_text": (
                f"<p><strong>{store_name}</strong> is your dedicated beauty partner, "
                "offering innovative solutions to enhance your appearance and reveal "
                "your natural radiance with confidence.</p>"
            ),
            "trust_badges": [
                {"heading": "Secure Payment", "description": "100% secure transactions with SSL encryption."},
                {"heading": "Tracked Delivery", "description": "Real-time parcel tracking for your peace of mind."},
                {"heading": "Satisfaction Guaranteed", "description": "Free returns within 30 days, no questions asked."},
                {"heading": "Customer Service", "description": "Dedicated team available 7 days a week by email."},
            ],
            "newsletter_heading": "Stay informed",
            "newsletter_text": (
                f"Sign up for exclusive offers and the latest news from {store_name}."
            ),
        }
    else:  # DE
        footer = {
            "brand_text": (
                f"<p><strong>{store_name}</strong> ist Ihr engagierter Schönheitspartner, "
                "der innovative Lösungen anbietet, um Ihr Erscheinungsbild zu verbessern "
                "und Ihre natürliche Ausstrahlung selbstbewusst zu enthüllen.</p>"
            ),
            "trust_badges": [
                {"heading": "Sichere Zahlung", "description": "100% sichere Transaktionen mit SSL-Verschlüsselung."},
                {"heading": "Sendungsverfolgung", "description": "Echtzeit-Paketverfolgung für Ihre Sicherheit."},
                {"heading": "Zufriedenheitsgarantie", "description": "Kostenlose Rücksendung innerhalb von 30 Tagen."},
                {"heading": "Kundendienst", "description": "Unser Team ist 7 Tage die Woche per E-Mail erreichbar."},
            ],
            "newsletter_heading": "Bleiben Sie informiert",
            "newsletter_text": (
                f"Melden Sie sich an für exklusive Angebote und Neuigkeiten von {store_name}."
            ),
        }

    is_de = lang.startswith("de")

    # Footer link_list headings (nav section titles): empty for FR = keep originals
    if is_fr:
        link_list_headings: list[str] = []
    elif is_en:
        link_list_headings = ["IMPORTANT INFORMATION", "LEGAL INFORMATION"]
    else:  # DE
        link_list_headings = ["WICHTIGE INFORMATIONEN", "RECHTLICHE INFORMATIONEN"]

    footer["link_list_headings"] = link_list_headings

    return {
        "header": header,
        "footer": footer,
        "cart": {
            "button_text": "JETZT BESTELLEN" if is_de else (
                "ORDER NOW" if is_en else "COMMANDER MAINTENANT"
            ),
            "upsell_title": (
                "Vervollständigen Sie Ihre Bestellung" if is_de else (
                    "Complete your order" if is_en else "Complétez votre commande"
                )
            ),
            "upsell_button_text": "Hinzufügen" if is_de else ("Add" if is_en else ""),
            "protection_text": (
                "Paketschutz inklusive" if is_de else (
                    "Package protection included" if is_en else ""
                )
            ),
            "cart_footer_text": (
                "<strong>⭐4.8/5 Trustpilot | 🔐 Sichere Zahlung</strong>" if is_de else (
                    "<strong>⭐4.8/5 Trustpilot | 🔐 Secure Payment</strong>" if is_en else ""
                )
            ),
            "savings_text": (
                "Sie sparen" if is_de else (
                    "You save" if is_en else ""
                )
            ),
            "subtotal_text": "Zwischensumme" if is_de else (
                "Subtotal" if is_en else ""
            ),
            "total_text": "Gesamt" if is_de else (
                "Total" if is_en else ""
            ),
        },
        "delivery": {
            "today_info": (
                "Bestellt" if is_de else (
                    "Ordered" if is_en else ""
                )
            ),
            "ready_info": (
                "Versandbereit" if is_de else (
                    "Ready to ship" if is_en else ""
                )
            ),
            "delivered_info": (
                "Geliefert" if is_de else (
                    "Delivered" if is_en else ""
                )
            ),
        },
        "settings": {
            "product_card_button_text": (
                "In den Warenkorb" if is_de else (
                    "Add to cart" if is_en else ""
                )
            ),
            "timer_timeout_text": (
                "Rabatt läuft bald ab" if is_de else (
                    "Discount ending soon" if is_en else ""
                )
            ),
        },
    }


# ══════════════════════════════════════════════════════════════════════════════
#  ENGLISH MOCK DATA
# ══════════════════════════════════════════════════════════════════════════════

def _mock_homepage_en(store_name: str, product: str, target_gender: str) -> dict:
    return {
        "slogan": f"{store_name}: Redefine Your Jawline, Reveal Your Confidence.",
        "welcome": {
            "title": f"Welcome to {store_name}",
            "text": (
                f"<p>We are thrilled to welcome you to <strong>{store_name}</strong>, "
                "your destination for transforming your facial contour and rediscovering "
                f"your confidence with our revolutionary <strong>{product}</strong>.</p>"
            ),
        },
        "benefits": [
            {
                "title": "Redefined Jawline",
                "text": "Sculpts and slims the chin and jaw contours for a sharper profile.",
            },
            {
                "title": "Firm & Toned Skin",
                "text": "Immediate lifting effect for visibly younger, firmer-looking skin.",
            },
            {
                "title": "Renewed Confidence",
                "text": "Boost your self-esteem with a perfectly refined facial profile.",
            },
        ],
        "advantages": [
            {
                "title": "Sculpt a Perfect Jawline in Just 3 Weeks",
                "text": (
                    f"<p>Our <strong>{product}</strong> effectively targets the double chin, "
                    "reshaping your facial contours. Achieve a more defined and harmonious "
                    "jawline effortlessly.</p>"
                ),
            },
            {
                "title": "Visible Lifting from the Very First Use",
                "text": (
                    "<p>Experience an <strong>immediate tightening effect</strong> that "
                    "smooths and firms your skin. Enjoy firmer, more elastic skin "
                    "day after day.</p>"
                ),
            },
            {
                "title": "Rediscover a Radiant Youth, Naturally",
                "text": (
                    "<p>Our <strong>advanced formula</strong> fades signs of aging and "
                    "revitalizes your skin. Reveal a visibly younger, more dynamic "
                    "neck and chin.</p>"
                ),
            },
            {
                "title": "Build an Easy & Effective Home Beauty Ritual",
                "text": (
                    "<p>Seamlessly integrate this <strong>expert care</strong> into your "
                    "routine without time constraints. Enjoy a relaxing moment for "
                    "professional results at home.</p>"
                ),
            },
            {
                "title": "Radiate Confidence with a Refined Profile",
                "text": (
                    "<p>A slimmer face and firmer skin <strong>boost your self-confidence"
                    "</strong>. Display your beauty with assurance and elegance in "
                    "every situation.</p>"
                ),
            },
            {
                "title": "Intense Hydration for Plumper Skin",
                "text": (
                    "<p>Enriched with <strong>hydrating actives</strong>, our mask deeply "
                    "nourishes the epidermis. Your skin is left soft, supple and "
                    "visibly plumper.</p>"
                ),
            },
            {
                "title": "A Non-Invasive and Comfortable Solution",
                "text": (
                    f"<p>Say goodbye to invasive and uncomfortable methods. "
                    f"<strong>{store_name}</strong> offers a gentle, effective alternative "
                    "for natural, lasting results.</p>"
                ),
            },
        ],
        "comparison": {
            "title": f"Why choose {store_name}?",
            "description": f"Discover why our customers love our {product}.",
            "items": [
                {
                    "feature": "Precise Targeting",
                    "tooltip": "Formula specifically designed to redefine the facial oval and reduce double chin.",
                },
                {
                    "feature": "Long-Lasting Lifting",
                    "tooltip": "Provides an immediate tightening effect and progressive, lasting firmness.",
                },
                {
                    "feature": "Advanced Formula",
                    "tooltip": "Rich in powerful actives (collagen, hyaluronic acid) for deep action.",
                },
                {
                    "feature": "Optimal Comfort",
                    "tooltip": "Perfect adhesion, pleasant non-irritating texture for a relaxing experience.",
                },
                {
                    "feature": "Visible Results",
                    "tooltip": "Visibly slimmer face, firmer, smoother and more youthful-looking skin.",
                },
            ],
        },
        "specs": {
            "title": f"{store_name}: Your Essential Beauty Ally",
            "items": [
                {
                    "title": "Reshaped Oval",
                    "description": "Precisely targets double chin for a slimmer profile.",
                },
                {
                    "title": "Express Lifting",
                    "description": "Visible tightening effect from the very first application.",
                },
                {
                    "title": "Firmer Skin",
                    "description": "Improves elasticity for long-lasting firmness.",
                },
                {
                    "title": "Absolute Comfort",
                    "description": "Pleasant, non-irritating application that stays in place.",
                },
            ],
        },
        "cta_button_text": "Shop Now",
    }


def _mock_product_page_en(store_name: str, product: str, target_gender: str) -> dict:
    g = target_gender.lower()
    plural = "women" if g != "homme" else "men"

    return {
        "product_benefits": [
            {"short_title": "Redefines Facial Oval", "description": "Sculpts and slims the chin and jaw contours."},
            {"short_title": "Immediate Lifting Effect", "description": "Provides a feeling of firmness and tightness from the first use."},
            {"short_title": "Reduces Double Chin", "description": "Helps diminish the appearance of a double chin with regular use."},
            {"short_title": "Improves Skin Elasticity", "description": "Makes skin more toned and supple, fighting sagging."},
            {"short_title": "Deep Hydration", "description": "Intensely nourishes the skin for a smooth, plumped appearance."},
        ],
        "product_description": {
            "heading": "Description",
            "text": (
                f"<p><strong>{store_name}</strong>: Reveal the Beauty of Your Facial Contour</p>"
                f"<p>The <strong>{product}</strong> is more than just a skincare product — it is "
                f"a revolution for those who dream of a perfectly defined jawline and unshakeable "
                "confidence. Designed with premium cosmetic expertise, our mask is the "
                "<strong>non-invasive, ultra-effective</strong> solution for targeting double "
                "chin and skin laxity.</p>"
                "<p>At the heart of its efficacy lies our innovative hydrogel technology. This "
                "unique matrix perfectly adheres to your facial contours, optimising the "
                "penetration of actives: <strong>Marine Hydrolysed Collagen</strong>, "
                "<strong>Low Molecular Weight Hyaluronic Acid</strong>, firming plant extracts "
                f"(Caffeine, Ginger) and <strong>Vitamin E</strong> antioxidant.</p>"
                f"<p>Join thousands of {plural} who have already discovered the secret of "
                f"timeless beauty with {store_name}.</p>"
            ),
        },
        "how_it_works": {
            "heading": "How does it work?",
            "text": (
                f"<p>The <strong>{product}</strong> uses a perfect synergy between innovative "
                "hydrogel technology and powerful actives. Once applied, the mask conforms "
                "to the contours of your chin. Your body heat activates the gel, gradually "
                "releasing the active ingredients.</p>"
                "<p><strong>Immediate Tightening Effect:</strong> Polymers create an invisible "
                "film that lifts and firms the skin instantly.</p>"
                "<p><strong>Stimulation & Drainage:</strong> Plant extracts promote micro-"
                "circulation and lymphatic drainage.</p>"
                "<p><strong>Long-Lasting Firming:</strong> Collagen and hyaluronic acid "
                "stimulate the natural production of support fibres.</p>"
                "<p>Leave on for 30 to 60 minutes, 3 to 5 times per week. No rinsing needed.</p>"
            ),
        },
        "adoption": {
            "heading": f"+9860 {plural} have adopted it",
            "text": (
                f"<p>They all chose <strong>{store_name}</strong> to transform their facial "
                "contour and rediscover radiant confidence. Join our growing community who "
                "have discovered the secret of a sculpted profile, without surgery or "
                "constraints.</p>"
                "<p>Their unanimous testimonials praise the <strong>proven effectiveness</strong>, "
                "ease of use, and visible, lasting results.</p>"
            ),
        },
        "mini_reviews": [
            {
                "name": "Emily R.",
                "age": "28 years",
                "text": (
                    "I was very self-conscious about my double chin even at my age. "
                    f"I tried the {product} out of curiosity and I am blown away! After "
                    "just a few weeks, my jawline is sharper and more defined. "
                    "Delivery was super fast too — I recommend it 100%!"
                ),
            },
            {
                "name": "Sarah M.",
                "age": "44 years",
                "text": (
                    "As I've gotten older, I felt my neck losing its firmness. "
                    "This mask is a total game-changer! The lifting effect is immediate and "
                    "my skin is visibly more toned. It has become my evening beauty ritual "
                    "— a relaxing moment with incredible results."
                ),
            },
            {
                "name": "Claire B.",
                "age": "35 years",
                "text": (
                    "I have always been sceptical of miracle products, but "
                    f"{store_name} changed my mind. My double chin is less noticeable "
                    "and I feel much more comfortable taking photos. The customer service "
                    "is also very responsive — thank you so much!"
                ),
            },
        ],
        "section_headings": {
            "marquee": "They talk about us:",
            "ugc": "Real results from our customers",
            "product_tagline": "Premium Quality. Free Delivery",
            "delivery_promo": "🚚 Free Delivery Today Only",
            "buy_button": "ADD TO CART",
        },
        "delivery_info": {
            "heading": "Delivery Information",
            "text": (
                "<p>Our delivery times are between <strong>3 and 5 business days</strong>.</p>"
                "<p><strong>Note:</strong> We <strong>guarantee satisfaction or a full refund</strong> "
                "on all our products.</p>"
            ),
            "today_label": "Ordered",
            "ready_label": "Ready",
            "delivered_label": "Delivered",
        },
    }


def _mock_faq_en(store_name: str, product: str) -> dict:
    return {
        "faq": {
            "title": "Frequently Asked Questions",
            "items": [
                {
                    "question": f"How does the {product} work to reduce double chin?",
                    "answer": (
                        "<p>Our mask uses advanced hydrogel technology infused with powerful "
                        "actives such as <strong>collagen</strong>, hyaluronic acid and plant "
                        "extracts. These ingredients work in synergy to stimulate micro-"
                        "circulation, promote drainage and provide a tightening effect that "
                        "helps reshape the facial oval.</p>"
                    ),
                },
                {
                    "question": "How often should I use the mask to see results?",
                    "answer": (
                        f"<p>For optimal results, we recommend using the <strong>{store_name}"
                        "</strong> mask 3 to 5 times per week for <strong>30 to 60 minutes"
                        "</strong> per session. Many users notice a visible improvement within "
                        "the first few weeks of regular use.</p>"
                    ),
                },
                {
                    "question": f"Is the {product} suitable for all skin types?",
                    "answer": (
                        "<p>Yes, our formula has been developed to be gentle and "
                        "<strong>hypoallergenic</strong>, making it suitable for all skin "
                        "types, even the most sensitive. It is dermatologically tested and "
                        "free from irritating substances.</p>"
                    ),
                },
                {
                    "question": f"Can I reuse the {product}?",
                    "answer": (
                        f"<p>No, the <strong>{product}</strong> is designed for single use. "
                        "Each mask is infused with an optimal dose of active ingredients "
                        "released during application. Please use a fresh mask for each session "
                        "to ensure maximum hygiene and effectiveness.</p>"
                    ),
                },
                {
                    "question": f"What are the key ingredients in the {product}?",
                    "answer": (
                        "<p>Our mask is formulated with high-quality ingredients: "
                        "<strong>hyaluronic acid</strong> for deep hydration, "
                        "<strong>collagen</strong> to improve skin elasticity, and "
                        "<strong>plant extracts</strong> with firming and antioxidant "
                        "properties. This synergy helps tone, smooth and revitalise "
                        "the chin and neck area.</p>"
                    ),
                },
            ],
        }
    }


def _mock_reviews_en(store_name: str, product: str, target_gender: str) -> dict:
    g = target_gender.lower()
    if g == "homme":
        names = [
            ("James T.", "34 years"), ("Michael R.", "42 years"),
            ("Oliver S.", "29 years"), ("William B.", "56 years"),
            ("George H.", "38 years"), ("Henry P.", "49 years"),
            ("Charlie K.", "26 years"), ("Edward N.", "63 years"),
            ("Daniel W.", "31 years"), ("Thomas C.", "45 years"),
        ]
    else:
        names = [
            ("Emily R.", "24 years"), ("Sarah M.", "44 years"),
            ("Claire B.", "31 years"), ("Jessica L.", "57 years"),
            ("Hannah D.", "36 years"), ("Lucy G.", "29 years"),
            ("Emma V.", "43 years"), ("Olivia T.", "53 years"),
            ("Sophia K.", "39 years"), ("Amelia N.", "26 years"),
        ]

    review_data = [
        {
            "title": "Absolutely blown away by the results!",
            "text": (
                f"I was very self-conscious about my double chin even at my age. "
                f"I tried the {product} out of curiosity and I am completely blown away! "
                "After just a few weeks my jawline is sharper and my skin much more "
                "defined. Delivery was super fast — I recommend it 100%!"
            ),
            "response": (
                f"We are so happy to hear that our {product} is giving you such great "
                "results! Your confidence is our greatest reward. Thank you!"
            ),
        },
        {
            "title": "A real beauty revolution!",
            "text": (
                "As I've gotten older I felt my neck was losing its firmness. "
                f"This mask is a complete game-changer! The lifting effect is immediate "
                "and my skin is visibly more toned. It has become my evening beauty ritual."
            ),
            "response": (
                f"What a pleasure to read your review! We are delighted that "
                f"{store_name} fits perfectly into your routine."
            ),
        },
        {
            "title": "A product that delivers on its promises",
            "text": (
                "I have always been sceptical of miracle products, but "
                f"{store_name} changed my mind. My double chin is less noticeable "
                "and I feel much more comfortable taking photos. The customer service "
                "is also very responsive — thank you!"
            ),
            "response": (
                "Your testimonial means a great deal to us! We are proud to have "
                f"proven our products' effectiveness. Thank you for being part of the {store_name} community."
            ),
        },
        {
            "title": "Fast delivery, great results!",
            "text": (
                "I received my mask incredibly quickly! The application is easy and "
                "comfortable, and I can really feel my skin is firmer after each use. "
                "Excellent value for money for a product that truly delivers."
            ),
            "response": (
                "We are delighted that our fast delivery and our mask's effectiveness "
                "have impressed you! Your satisfaction drives us. Thank you for your trust!"
            ),
        },
        {
            "title": "Comfortable and effective",
            "text": (
                "The mask is very comfortable to wear and doesn't slip, which is a big "
                "plus. I have noticed a clear improvement in the elasticity of my skin "
                "around my chin. A product I will definitely reorder."
            ),
            "response": (
                "We are very pleased that the comfort and results of our mask appeal "
                "to you! Your loyalty is precious to us."
            ),
        },
        {
            "title": "My jawline has visibly slimmed",
            "text": (
                f"After 3 weeks of regular use of the {product}, I am astonished by "
                "the result. My jawline has visibly slimmed and my skin is so much "
                f"firmer. I never thought a mask could make such a difference! Thank you {store_name}!"
            ),
            "response": (
                f"Thank you for this wonderful testimonial! At {store_name} we believe "
                "in the power of innovative skincare to reveal natural beauty. Keep glowing!"
            ),
        },
        {
            "title": "At-home lifting really works!",
            "text": (
                "I was looking for a non-invasive alternative to costly aesthetic treatments. "
                f"The {product} is THE solution! From the very first use I felt a remarkable "
                "tightening effect. After a month, people around me started to notice!"
            ),
            "response": (
                "Your satisfaction is our greatest pride! We are delighted that our mask "
                "delivers professional-grade results in the comfort of your own home."
            ),
        },
        {
            "title": "Firmer and more youthful skin",
            "text": (
                "At 53, I had given up hope of seeing my double chin fade. "
                f"The {product} proved me wrong! My skin is so much firmer and my "
                "neck more defined. I feel ten years younger."
            ),
            "response": (
                "This testimonial touches us deeply! Our mission is to help every "
                "person feel beautiful and confident at any age. Thank you!"
            ),
        },
        {
            "title": "200% satisfied!",
            "text": (
                f"As a skincare enthusiast, the {product} truly stands out for its quality. "
                "The mask texture is pleasant, it adheres perfectly and the results are "
                "outstanding. My double chin has clearly reduced and my jawline is more defined."
            ),
            "response": (
                "Thank you for this enthusiastic review! We are delighted that our "
                f"{product} meets your high standards. Your opinion means everything to us!"
            ),
        },
        {
            "title": "Fast and lasting results",
            "text": (
                "What I love most about this mask is that results are both fast and lasting. "
                "From the first application I felt my skin was firmer. With regular use, "
                "the effects accumulate and are maintained. My jawline is truly more defined."
            ),
            "response": (
                f"That is exactly the effect we aim for with {store_name}! Immediate results "
                "that keep improving over time. Thank you for sharing your experience!"
            ),
        },
    ]

    reviews = []
    for i, (name_age, rev_data) in enumerate(zip(names, review_data)):
        name, age = name_age
        reviews.append({
            "name": name,
            "age": age,
            "rating": 5 if i % 5 != 4 else 4,
            "title": rev_data["title"],
            "text": rev_data["text"],
            "response": rev_data["response"],
        })

    return {"reviews": reviews}


def _mock_legal_pages_en(
    store_name: str,
    store_email: str,
    product: str,
    product_price: str | None,
    store_address: str | None,
    siret: str | None,
    delivery_delay: str,
    return_policy_days: str,
) -> dict:
    price_str = f"{product_price}" if product_price else "as per current pricing"
    address_str = store_address or "Address available on request"

    return {
        "conditions_vente": {
            "title": "Terms and Conditions of Sale",
            "content": (
                f"<h2>Terms and Conditions of Sale — {store_name}</h2>"
                "<h3>Article 1: Purpose</h3>"
                f"<p>These terms govern the sale of products offered by "
                f"<strong>{store_name}</strong> on its online store.</p>"
                "<h3>Article 2: Pricing</h3>"
                f"<p>All prices are shown inclusive of applicable taxes. "
                f"The {product} is available from <strong>{price_str}</strong>.</p>"
                "<h3>Article 3: Delivery</h3>"
                f"<p>Orders are dispatched within 24-48 business hours. "
                f"Estimated delivery time: <strong>{delivery_delay}</strong>.</p>"
                "<h3>Article 4: Right of Withdrawal</h3>"
                f"<p>You have <strong>{return_policy_days} days</strong> from receipt "
                "to return your item in its original condition.</p>"
                "<h3>Article 5: Contact</h3>"
                f"<p>Email: <a href=\"mailto:{store_email}\">{store_email}</a></p>"
            ),
        },
        "mentions_legales": {
            "title": "Legal Notice",
            "content": (
                f"<h2>Legal Notice — {store_name}</h2>"
                "<h3>Publisher</h3>"
                f"<p><strong>{store_name}</strong></p>"
                f"<p>Address: {address_str}</p>"
                f"<p>Email: <a href=\"mailto:{store_email}\">{store_email}</a></p>"
                "<h3>Hosting</h3>"
                "<p>Shopify Inc. — 150 Elgin St, Ottawa, ON K2P 1L4, Canada</p>"
                "<h3>Personal Data</h3>"
                "<p>In accordance with applicable data protection regulations, "
                "you have the right to access, rectify and delete your personal data. "
                f"Contact us at <a href=\"mailto:{store_email}\">{store_email}</a>.</p>"
            ),
        },
        "politique_expedition": {
            "title": "Shipping Policy",
            "content": (
                f"<h2>Shipping Policy — {store_name}</h2>"
                "<h3>Processing Times</h3>"
                "<p>Orders are processed within <strong>24-48 business hours</strong> "
                "after payment confirmation.</p>"
                "<h3>Estimated Delivery Times</h3>"
                "<ul>"
                f"<li><strong>Domestic:</strong> {delivery_delay}</li>"
                "<li><strong>Europe:</strong> 7-14 business days</li>"
                "<li><strong>International:</strong> 10-21 business days</li>"
                "</ul>"
                "<h3>Returns</h3>"
                f"<p>Returns accepted within <strong>{return_policy_days} days</strong> "
                "of receipt. Items must be unused and in original packaging.</p>"
                "<h3>Contact</h3>"
                f"<p><a href=\"mailto:{store_email}\">{store_email}</a></p>"
            ),
        },
    }


def _mock_story_page_en(store_name: str, product: str) -> dict:
    return {
        "page_heading": f"The Story of {store_name}",
        "page_subheading": (
            f"From a passion for beauty to innovation — "
            "discover our journey towards excellence."
        ),
        "timeline_events": [
            {
                "year": "2020",
                "heading": "The birth of an idea",
                "text": (
                    f"The {store_name} adventure begins with a simple idea: "
                    "to help everyone rediscover confidence in their appearance "
                    "through innovative and accessible solutions."
                ),
            },
            {
                "year": "2021",
                "heading": "Product development",
                "text": (
                    f"After months of research with dermatologists, our {product} is perfected. "
                    "The formula, enriched with premium actives, is finalised to deliver "
                    "visible results from the very first application."
                ),
            },
            {
                "year": "2022",
                "heading": "Official launch",
                "text": (
                    f"We officially launch {store_name} and our first product. "
                    "The reception exceeds all expectations: thousands of orders within "
                    "the first weeks and enthusiastic testimonials from customers."
                ),
            },
            {
                "year": "2023",
                "heading": "A growing community",
                "text": (
                    "Our community surpasses 10,000 satisfied customers. "
                    f"{store_name} becomes the reference in its field, "
                    "with results that speak for themselves."
                ),
            },
            {
                "year": "2024",
                "heading": "The future and innovation",
                "text": (
                    "Driven by our experience and our community's feedback, "
                    "we continue to innovate and expand our range. Our mission "
                    "remains unchanged: to reveal each person's natural beauty "
                    "with effective, gentle and eco-responsible solutions."
                ),
            },
        ],
    }


# ══════════════════════════════════════════════════════════════════════════════
#  GERMAN MOCK DATA
# ══════════════════════════════════════════════════════════════════════════════

def _mock_homepage_de(store_name: str, product: str, target_gender: str) -> dict:
    return {
        "slogan": f"{store_name}: Definieren Sie Ihr Kinn neu und enthüllen Sie Ihr Selbstvertrauen.",
        "welcome": {
            "title": f"Willkommen bei {store_name}",
            "text": (
                f"<p>Wir freuen uns, Sie bei <strong>{store_name}</strong> begrüßen zu dürfen — "
                "Ihrer Anlaufstelle für die Transformation Ihrer Gesichtskontur und die "
                f"Wiederentdeckung Ihres Selbstvertrauens mit unserem revolutionären "
                f"<strong>{product}</strong>.</p>"
            ),
        },
        "benefits": [
            {
                "title": "Neu definiertes Kinn",
                "text": "Formt und strafft die Kinn- und Kieferpartie für ein schärferes Profil.",
            },
            {
                "title": "Straffe und glatte Haut",
                "text": "Sofortiger Liftingeffekt für sichtbar jüngere, festere Haut.",
            },
            {
                "title": "Neu gewonnenes Selbstvertrauen",
                "text": "Stärken Sie Ihr Selbstwertgefühl mit einem verfeinerten Gesichtsprofil.",
            },
        ],
        "advantages": [
            {
                "title": "Perfektes Kinn in nur 3 Wochen",
                "text": (
                    f"<p>Unser <strong>{product}</strong> zielt effektiv auf das Doppelkinn ab "
                    "und formt Ihre Gesichtskontur neu. Erzielen Sie ein schärferes und "
                    "harmonischeres Kinn — ganz ohne Aufwand.</p>"
                ),
            },
            {
                "title": "Sichtbarer Liftingeffekt ab der ersten Anwendung",
                "text": (
                    "<p>Spüren Sie einen <strong>sofortigen Straffungseffekt</strong>, der "
                    "Ihre Haut glättet und festigt. Genießen Sie Tag für Tag straffere, "
                    "elastischere Haut.</p>"
                ),
            },
            {
                "title": "Natürliche Jugendlichkeit zurückgewinnen",
                "text": (
                    "<p>Unsere <strong>fortschrittliche Formel</strong> mildert Alterszeichen "
                    "und revitalisiert Ihre Haut. Enthüllen Sie ein sichtbar jüngeres, "
                    "dynamischeres Kinn und einen strafferen Hals.</p>"
                ),
            },
            {
                "title": "Einfaches und effektives Schönheitsritual zu Hause",
                "text": (
                    "<p>Integrieren Sie diese <strong>Expertenpflege</strong> mühelos in "
                    "Ihre tägliche Routine. Genießen Sie einen entspannenden Moment mit "
                    "professionellen Ergebnissen im Komfort Ihres Zuhauses.</p>"
                ),
            },
            {
                "title": "Strahlen Sie Selbstbewusstsein mit einem verfeinertem Profil aus",
                "text": (
                    "<p>Ein schlankeres Gesicht und festere Haut <strong>stärken Ihr "
                    "Selbstbewusstsein</strong>. Zeigen Sie Ihre Schönheit mit Eleganz "
                    "und Selbstsicherheit in jeder Situation.</p>"
                ),
            },
            {
                "title": "Intensive Feuchtigkeit für vollere Haut",
                "text": (
                    "<p>Angereichert mit <strong>feuchtigkeitsspendenden Wirkstoffen</strong>, "
                    "nährt unsere Maske die Haut tief. Ihre Haut wird weich, geschmeidig "
                    "und sichtbar praller.</p>"
                ),
            },
            {
                "title": "Eine nicht-invasive und angenehme Lösung",
                "text": (
                    f"<p>Sagen Sie Lebewohl zu invasiven und unangenehmen Methoden. "
                    f"<strong>{store_name}</strong> bietet eine sanfte, wirksame Alternative "
                    "für natürliche und dauerhafte Ergebnisse.</p>"
                ),
            },
        ],
        "comparison": {
            "title": f"Warum {store_name} wählen?",
            "description": f"Entdecken Sie, warum unsere Kunden unser {product} lieben.",
            "items": [
                {
                    "feature": "Präzise Wirkung",
                    "tooltip": "Speziell entwickelte Formel zur Neuformung der Gesichtskontur und Reduzierung des Doppelkinns.",
                },
                {
                    "feature": "Anhaltender Liftingeffekt",
                    "tooltip": "Sofortiger Straffungseffekt und progressiv anhaltende Festigkeit.",
                },
                {
                    "feature": "Fortschrittliche Formel",
                    "tooltip": "Reich an wirksamen Inhaltsstoffen (Kollagen, Hyaluronsäure) für tiefenwirksame Wirkung.",
                },
                {
                    "feature": "Optimaler Komfort",
                    "tooltip": "Perfekte Haftung, angenehme nicht-reizende Textur für ein entspannendes Pflegeerlebnis.",
                },
                {
                    "feature": "Sichtbare Ergebnisse",
                    "tooltip": "Sichtbar schlankeres Gesicht, festere, glattere und jünger aussehende Haut.",
                },
            ],
        },
        "specs": {
            "title": f"{store_name}: Ihr unverzichtbarer Schönheitspartner",
            "items": [
                {
                    "title": "Neu geformte Kontur",
                    "description": "Zielt präzise auf das Doppelkinn für ein schlankeres Profil.",
                },
                {
                    "title": "Express-Lifting",
                    "description": "Sichtbarer Straffungseffekt ab der ersten Anwendung.",
                },
                {
                    "title": "Festere Haut",
                    "description": "Verbessert die Elastizität für anhaltende Festigkeit.",
                },
                {
                    "title": "Absoluter Komfort",
                    "description": "Angenehme, nicht-reizende Anwendung, die sicher haftet.",
                },
            ],
        },
        "cta_button_text": "Jetzt kaufen",
    }


def _mock_product_page_de(store_name: str, product: str, target_gender: str) -> dict:
    g = target_gender.lower()
    plural = "Männer" if g == "homme" else "Frauen"

    return {
        "product_benefits": [
            {"short_title": "Definiert Gesichtskontur", "description": "Formt und strafft die Kinn- und Kieferpartie."},
            {"short_title": "Sofortiger Liftingeffekt", "description": "Bietet ein Gefühl von Festigkeit ab der ersten Anwendung."},
            {"short_title": "Reduziert Doppelkinn", "description": "Mindert das Erscheinungsbild des Doppelkinns bei regelmäßiger Anwendung."},
            {"short_title": "Verbessert Hautelastizität", "description": "Macht die Haut straffer und geschmeidiger gegen Erschlaffung."},
            {"short_title": "Tiefe Feuchtigkeitspflege", "description": "Nährt die Haut intensiv für ein glattes, pralleres Erscheinungsbild."},
        ],
        "product_description": {
            "heading": "Produktbeschreibung",
            "text": (
                f"<p><strong>{store_name}</strong>: Enthüllen Sie die Schönheit Ihrer Gesichtskontur</p>"
                f"<p>Das <strong>{product}</strong> ist mehr als nur eine Hautpflege — es ist "
                f"eine Revolution für alle, die von einem perfekt definierten Kinn und unerschütterlichem "
                "Selbstvertrauen träumen. Konzipiert mit Premium-Kosmetikexpertise, ist unsere Maske die "
                "<strong>nicht-invasive, hochwirksame</strong> Lösung gegen Doppelkinn und Hauterschlaffung.</p>"
                "<p>Im Kern ihrer Wirksamkeit steht unsere innovative Hydrogel-Technologie. Diese einzigartige "
                "Matrix haftet perfekt an Ihren Gesichtskonturen und optimiert die Aufnahme der Wirkstoffe: "
                "<strong>Hydrolysiertes Meereskollagen</strong>, <strong>Niedermolekulare Hyaluronsäure</strong>, "
                f"straffende Pflanzenauszüge (Koffein, Ingwer) und <strong>Vitamin E</strong>.</p>"
                f"<p>Schließen Sie sich tausenden von {plural} an, die das Geheimnis zeitloser Schönheit "
                f"mit {store_name} entdeckt haben.</p>"
            ),
        },
        "how_it_works": {
            "heading": "Wie funktioniert es?",
            "text": (
                f"<p>Das <strong>{product}</strong> nutzt eine perfekte Synergie aus innovativer "
                "Hydrogel-Technologie und wirksamen Inhaltsstoffen. Einmal aufgetragen, schmiegt "
                "sich die Maske an Ihre Kinnkonturen. Ihre Körperwärme aktiviert das Gel und setzt "
                "die Wirkstoffe schrittweise frei.</p>"
                "<p><strong>Sofortiger Straffungseffekt:</strong> Polymere bilden einen unsichtbaren "
                "Film, der die Haut sofort liftet und festigt.</p>"
                "<p><strong>Stimulation und Drainage:</strong> Pflanzenauszüge fördern die "
                "Mikrozirkulation und den Lymphabfluss.</p>"
                "<p><strong>Anhaltende Festigung:</strong> Kollagen und Hyaluronsäure stimulieren "
                "die natürliche Produktion von Stützfasern.</p>"
                "<p>30 bis 60 Minuten einwirken lassen, 3 bis 5 Mal pro Woche. Kein Abspülen erforderlich.</p>"
            ),
        },
        "adoption": {
            "heading": f"+9860 {plural} haben es übernommen",
            "text": (
                f"<p>Sie alle haben sich für <strong>{store_name}</strong> entschieden, um ihre "
                "Gesichtskontur zu transformieren und strahlendes Selbstvertrauen zurückzugewinnen. "
                "Schließen Sie sich unserer wachsenden Gemeinschaft an, die das Geheimnis eines "
                "definierten Profils entdeckt hat — ohne chirurgischen Eingriff.</p>"
                "<p>Ihre einstimmigen Berichte loben die <strong>bewährte Wirksamkeit</strong>, "
                "die einfache Anwendung und die sichtbaren, dauerhaften Ergebnisse.</p>"
            ),
        },
        "mini_reviews": [
            {
                "name": "Lena M.",
                "age": "27 Jahre",
                "text": (
                    "Ich war sehr unsicher wegen meines Doppelkinns, sogar in meinem Alter. "
                    f"Ich habe das {product} aus Neugier ausprobiert und bin begeistert! "
                    "Nach nur wenigen Wochen ist mein Kinn schärfer definiert. "
                    "Die Lieferung war auch super schnell — ich empfehle es zu 100%!"
                ),
            },
            {
                "name": "Petra S.",
                "age": "46 Jahre",
                "text": (
                    "Mit zunehmendem Alter hatte ich das Gefühl, dass mein Hals seine "
                    "Straffheit verliert. Diese Maske ist eine echte Revolution! Der "
                    "Liftingeffekt ist sofort spürbar und meine Haut ist sichtbar straffer."
                ),
            },
            {
                "name": "Julia K.",
                "age": "33 Jahre",
                "text": (
                    "Ich war immer skeptisch gegenüber Wunderprodukten, aber "
                    f"{store_name} hat meine Meinung geändert. Mein Doppelkinn ist "
                    "weniger ausgeprägt und ich fühle mich viel wohler beim Fotografieren. "
                    "Der Kundenservice ist auch sehr reaktionsschnell — vielen Dank!"
                ),
            },
        ],
        "section_headings": {
            "marquee": "Das sagen unsere Kunden:",
            "ugc": "Echte Ergebnisse unserer Kunden",
            "product_tagline": "Premiumqualität. Kostenlose Lieferung",
            "delivery_promo": "🚚 Kostenlose Lieferung nur heute",
            "buy_button": "IN DEN WARENKORB",
        },
        "delivery_info": {
            "heading": "Lieferinformationen",
            "text": (
                "<p>Unsere Lieferzeiten betragen <strong>3 bis 5 Werktage</strong>.</p>"
                "<p><strong>Hinweis:</strong> Wir <strong>garantieren Zufriedenheit oder vollständige Rückerstattung</strong> "
                "für alle unsere Produkte.</p>"
            ),
            "today_label": "Bestellt",
            "ready_label": "Versandbereit",
            "delivered_label": "Geliefert",
        },
    }


def _mock_faq_de(store_name: str, product: str) -> dict:
    return {
        "faq": {
            "title": "Häufig gestellte Fragen",
            "items": [
                {
                    "question": f"Wie funktioniert das {product} zur Reduzierung des Doppelkinns?",
                    "answer": (
                        "<p>Unsere Maske verwendet fortschrittliche Hydrogel-Technologie, "
                        "imprägniert mit wirksamen Inhaltsstoffen wie <strong>Kollagen</strong>, "
                        "Hyaluronsäure und Pflanzenauszügen. Diese Inhaltsstoffe wirken synergistisch, "
                        "um die Mikrozirkulation zu stimulieren, den Lymphabfluss zu fördern und einen "
                        "Straffungseffekt zu bieten, der die Gesichtskontur neu modelliert.</p>"
                    ),
                },
                {
                    "question": "Wie oft sollte ich die Maske verwenden, um Ergebnisse zu sehen?",
                    "answer": (
                        f"<p>Für optimale Ergebnisse empfehlen wir, die <strong>{store_name}</strong> "
                        "Maske 3 bis 5 Mal pro Woche für <strong>30 bis 60 Minuten</strong> pro "
                        "Sitzung zu verwenden. Viele Anwenderinnen bemerken eine sichtbare "
                        "Verbesserung bereits nach den ersten Wochen regelmäßiger Anwendung.</p>"
                    ),
                },
                {
                    "question": f"Ist das {product} für alle Hauttypen geeignet?",
                    "answer": (
                        "<p>Ja, unsere Formel wurde entwickelt, um sanft und "
                        "<strong>hypoallergen</strong> zu sein und eignet sich für alle "
                        "Hauttypen, auch für die empfindlichsten. Sie ist dermatologisch "
                        "getestet und enthält keine reizenden Substanzen.</p>"
                    ),
                },
                {
                    "question": f"Kann ich das {product} wiederverwenden?",
                    "answer": (
                        f"<p>Nein, das <strong>{product}</strong> ist für den Einmalgebrauch "
                        "konzipiert. Jede Maske ist mit einer optimalen Dosis Wirkstoffe imprägniert, "
                        "die bei der Anwendung freigesetzt werden. Verwenden Sie für jede Sitzung "
                        "eine neue Maske für maximale Hygiene und Wirksamkeit.</p>"
                    ),
                },
                {
                    "question": f"Was sind die wichtigsten Inhaltsstoffe des {product}?",
                    "answer": (
                        "<p>Unsere Maske ist mit hochwertigen Inhaltsstoffen formuliert: "
                        "<strong>Hyaluronsäure</strong> für tiefe Feuchtigkeit, "
                        "<strong>Kollagen</strong> zur Verbesserung der Hautelastizität, und "
                        "<strong>Pflanzenauszüge</strong> mit straffenden und antioxidativen "
                        "Eigenschaften. Diese Synergie hilft, die Kinn- und Halspartie zu "
                        "straffen, zu glätten und zu revitalisieren.</p>"
                    ),
                },
            ],
        }
    }


def _mock_reviews_de(store_name: str, product: str, target_gender: str) -> dict:
    g = target_gender.lower()
    if g == "homme":
        names = [
            ("Thomas M.", "33 Jahre"), ("Michael S.", "42 Jahre"),
            ("Andreas K.", "29 Jahre"), ("Stefan R.", "56 Jahre"),
            ("Markus B.", "38 Jahre"), ("Klaus P.", "49 Jahre"),
            ("Jürgen W.", "26 Jahre"), ("Rainer N.", "63 Jahre"),
            ("Dieter H.", "31 Jahre"), ("Wolfgang C.", "45 Jahre"),
        ]
    else:
        names = [
            ("Lena M.", "24 Jahre"), ("Petra S.", "44 Jahre"),
            ("Julia K.", "32 Jahre"), ("Monika R.", "57 Jahre"),
            ("Sandra D.", "37 Jahre"), ("Katharina G.", "29 Jahre"),
            ("Sabine V.", "43 Jahre"), ("Claudia T.", "53 Jahre"),
            ("Birgit F.", "39 Jahre"), ("Ingrid N.", "26 Jahre"),
        ]

    review_data = [
        {
            "title": "Von den Ergebnissen begeistert!",
            "text": (
                f"Ich war sehr unsicher wegen meines Doppelkinns, sogar in meinem Alter. "
                f"Ich habe das {product} aus Neugier ausprobiert und bin völlig begeistert! "
                "Nach nur wenigen Wochen ist mein Kinn schärfer und mein Gesicht definierter. "
                "Die Lieferung war super schnell — ich empfehle es zu 100%!"
            ),
            "response": (
                f"Wir freuen uns sehr zu hören, dass unser {product} Ihnen so großartige "
                "Ergebnisse bringt! Ihr Vertrauen ist unsere schönste Belohnung."
            ),
        },
        {
            "title": "Eine echte Schönheitsrevolution!",
            "text": (
                "Mit zunehmendem Alter hatte ich das Gefühl, dass mein Hals seine Straffheit "
                f"verliert. Diese Maske ist eine echte Revolution! Der Liftingeffekt ist sofort "
                "spürbar und meine Haut ist sichtbar straffer. Es ist mein abendliches Schönheitsritual geworden."
            ),
            "response": (
                f"Wie schön, Ihre Bewertung zu lesen! Wir freuen uns, dass {store_name} "
                "perfekt in Ihre Routine passt."
            ),
        },
        {
            "title": "Ein Produkt, das seine Versprechen hält",
            "text": (
                "Ich war immer skeptisch gegenüber Wunderprodukten, aber "
                f"{store_name} hat meine Meinung geändert. Mein Doppelkinn ist weniger "
                "ausgeprägt und ich fühle mich viel wohler beim Fotografieren. "
                "Der Kundenservice ist auch sehr reaktionsschnell — vielen Dank!"
            ),
            "response": (
                "Ihre Aussage berührt uns besonders! Wir sind stolz darauf, die "
                f"Wirksamkeit unserer Produkte bewiesen zu haben."
            ),
        },
        {
            "title": "Schnelle Lieferung, tolle Ergebnisse!",
            "text": (
                "Ich habe meine Maske unglaublich schnell erhalten! Die Anwendung ist einfach "
                "und angenehm, und ich spüre wirklich, dass meine Haut nach jeder Anwendung "
                "fester ist. Sehr gutes Preis-Leistungs-Verhältnis!"
            ),
            "response": (
                "Wir freuen uns, dass unsere schnelle Lieferung und die Wirksamkeit unserer "
                "Maske Sie begeistert haben! Danke für Ihr Vertrauen!"
            ),
        },
        {
            "title": "Komfortabel und effektiv",
            "text": (
                "Die Maske ist sehr angenehm zu tragen und verrutscht nicht. "
                "Ich habe eine deutliche Verbesserung der Elastizität meiner Haut "
                "im Kinnbereich bemerkt. Ein Produkt, das ich definitiv nachbestellen werde."
            ),
            "response": (
                "Wir sind sehr erfreut, dass Ihnen der Komfort und die Ergebnisse unserer "
                "Maske gefallen! Ihre Treue ist uns sehr wertvoll."
            ),
        },
        {
            "title": "Mein Kinn hat sich sichtbar verschlankt",
            "text": (
                f"Nach 3 Wochen regelmäßiger Anwendung des {product} bin ich von "
                "dem Ergebnis begeistert. Mein Kinn hat sich sichtbar verschlankt "
                f"und meine Haut ist viel fester. Ich hätte nicht geglaubt, dass eine "
                f"Maske einen solchen Unterschied machen kann! Danke {store_name}!"
            ),
            "response": (
                f"Danke für dieses wunderbare Zeugnis! Bei {store_name} glauben wir "
                "an die Kraft innovativer Hautpflege, um natürliche Schönheit zu enthüllen."
            ),
        },
        {
            "title": "Lifting zu Hause funktioniert wirklich!",
            "text": (
                "Ich suchte nach einer nicht-invasiven Alternative zu teuren ästhetischen "
                f"Behandlungen. Das {product} ist DIE Lösung! Schon bei der ersten Anwendung "
                "spürte ich einen bemerkenswerten Straffungseffekt."
            ),
            "response": (
                "Ihre Zufriedenheit ist unser größter Stolz! Wir freuen uns, dass unsere "
                "Maske Ihnen professionelle Ergebnisse im Komfort Ihres Zuhauses bietet."
            ),
        },
        {
            "title": "Festere und jünger aussehende Haut",
            "text": (
                "Mit 53 Jahren hatte ich die Hoffnung aufgegeben, mein Doppelkinn zu reduzieren. "
                f"Das {product} hat mir das Gegenteil bewiesen! Meine Haut ist so viel fester "
                "und mein Hals definierter. Ich fühle mich zehn Jahre jünger."
            ),
            "response": (
                "Dieses Zeugnis berührt uns sehr! Unsere Mission ist es, jedem Menschen zu "
                "helfen, sich in jedem Alter schön und selbstbewusst zu fühlen."
            ),
        },
        {
            "title": "200% zufrieden!",
            "text": (
                f"Als Schönheitspflegeliebhaberin sticht das {product} wirklich durch seine "
                "Qualität hervor. Die Textur der Maske ist angenehm, sie haftet perfekt und "
                "die Ergebnisse sprechen für sich. Mein Doppelkinn hat sich deutlich reduziert."
            ),
            "response": (
                f"Danke für diese begeisterte Bewertung! Wir sind erfreut, dass unser "
                f"{product} Ihren hohen Ansprüchen entspricht."
            ),
        },
        {
            "title": "Schnelle und dauerhafte Ergebnisse",
            "text": (
                "Was mich an dieser Maske besonders begeistert, ist, dass die Ergebnisse "
                "sowohl schnell als auch dauerhaft sind. Schon bei der ersten Anwendung "
                "spürte ich, dass meine Haut fester war. Mit regelmäßiger Anwendung "
                "bauen sich die Effekte auf und bleiben erhalten."
            ),
            "response": (
                f"Genau das ist der Effekt, den wir mit {store_name} erzielen möchten! "
                "Sofortige Ergebnisse, die sich mit der Zeit verbessern. Danke!"
            ),
        },
    ]

    reviews = []
    for i, (name_age, rev_data) in enumerate(zip(names, review_data)):
        name, age = name_age
        reviews.append({
            "name": name,
            "age": age,
            "rating": 5 if i % 5 != 4 else 4,
            "title": rev_data["title"],
            "text": rev_data["text"],
            "response": rev_data["response"],
        })

    return {"reviews": reviews}


def _mock_legal_pages_de(
    store_name: str,
    store_email: str,
    product: str,
    product_price: str | None,
    store_address: str | None,
    siret: str | None,
    delivery_delay: str,
    return_policy_days: str,
) -> dict:
    price_str = f"{product_price} €" if product_price else "zum jeweils gültigen Preis"
    address_str = store_address or "Adresse auf Anfrage erhältlich"

    return {
        "conditions_vente": {
            "title": "Allgemeine Geschäftsbedingungen",
            "content": (
                f"<h2>Allgemeine Geschäftsbedingungen — {store_name}</h2>"
                "<h3>Artikel 1: Gegenstand</h3>"
                f"<p>Diese AGB regeln den Verkauf von Produkten, die von "
                f"<strong>{store_name}</strong> in seinem Online-Shop angeboten werden.</p>"
                "<h3>Artikel 2: Preise</h3>"
                f"<p>Alle Preise verstehen sich inklusive der gesetzlichen Mehrwertsteuer. "
                f"Das {product} ist ab <strong>{price_str}</strong> erhältlich.</p>"
                "<h3>Artikel 3: Lieferung</h3>"
                f"<p>Bestellungen werden innerhalb von 24-48 Werktagen versandt. "
                f"Geschätzte Lieferzeit: <strong>{delivery_delay}</strong>.</p>"
                "<h3>Artikel 4: Widerrufsrecht</h3>"
                f"<p>Sie haben <strong>{return_policy_days} Tage</strong> ab Erhalt, "
                "um den Artikel in seinem Originalzustand zurückzusenden.</p>"
                "<h3>Artikel 5: Kontakt</h3>"
                f"<p>E-Mail: <a href=\"mailto:{store_email}\">{store_email}</a></p>"
            ),
        },
        "mentions_legales": {
            "title": "Impressum",
            "content": (
                f"<h2>Impressum — {store_name}</h2>"
                "<h3>Herausgeber</h3>"
                f"<p><strong>{store_name}</strong></p>"
                f"<p>Adresse: {address_str}</p>"
                f"<p>E-Mail: <a href=\"mailto:{store_email}\">{store_email}</a></p>"
                "<h3>Hosting</h3>"
                "<p>Shopify Inc. — 150 Elgin St, Ottawa, ON K2P 1L4, Kanada</p>"
                "<h3>Datenschutz</h3>"
                "<p>Gemäß den geltenden Datenschutzbestimmungen haben Sie das Recht, "
                "Ihre personenbezogenen Daten einzusehen, zu berichtigen und zu löschen. "
                f"Kontaktieren Sie uns unter <a href=\"mailto:{store_email}\">{store_email}</a>.</p>"
            ),
        },
        "politique_expedition": {
            "title": "Versandrichtlinien",
            "content": (
                f"<h2>Versandrichtlinien — {store_name}</h2>"
                "<h3>Bearbeitungszeiten</h3>"
                "<p>Bestellungen werden innerhalb von <strong>24-48 Werktagen</strong> "
                "nach Zahlungsbestätigung bearbeitet.</p>"
                "<h3>Geschätzte Lieferzeiten</h3>"
                "<ul>"
                f"<li><strong>Deutschland/Österreich/Schweiz:</strong> {delivery_delay}</li>"
                "<li><strong>Europa:</strong> 7-14 Werktage</li>"
                "<li><strong>International:</strong> 10-21 Werktage</li>"
                "</ul>"
                "<h3>Rücksendungen</h3>"
                f"<p>Rücksendungen werden innerhalb von <strong>{return_policy_days} Tagen</strong> "
                "nach Erhalt akzeptiert. Artikel müssen unbenutzt und in der Originalverpackung sein.</p>"
                "<h3>Kontakt</h3>"
                f"<p><a href=\"mailto:{store_email}\">{store_email}</a></p>"
            ),
        },
    }


def _mock_story_page_de(store_name: str, product: str) -> dict:
    return {
        "page_heading": f"Die Geschichte von {store_name}",
        "page_subheading": (
            f"Von der Leidenschaft für Schönheit zur Innovation — "
            "entdecken Sie unseren Weg zur Exzellenz."
        ),
        "timeline_events": [
            {
                "year": "2020",
                "heading": "Die Geburt einer Idee",
                "text": (
                    f"Das Abenteuer {store_name} beginnt mit einer einfachen Idee: "
                    "jedem Menschen zu helfen, das Vertrauen in sein Erscheinungsbild "
                    "durch innovative und zugängliche Lösungen zurückzugewinnen."
                ),
            },
            {
                "year": "2021",
                "heading": "Produktentwicklung",
                "text": (
                    f"Nach monatelanger Forschung mit Dermatologen wird unser {product} perfektioniert. "
                    "Die mit Premium-Wirkstoffen angereicherte Formel wird für sichtbare Ergebnisse "
                    "ab der ersten Anwendung finalisiert."
                ),
            },
            {
                "year": "2022",
                "heading": "Offizieller Launch",
                "text": (
                    f"Wir starten {store_name} offiziell. Der Empfang übertrifft alle Erwartungen: "
                    "Tausende von Bestellungen in den ersten Wochen und begeisterte Kundenmeinungen."
                ),
            },
            {
                "year": "2023",
                "heading": "Eine wachsende Gemeinschaft",
                "text": (
                    "Unsere Gemeinschaft überschreitet 10.000 zufriedene Kunden. "
                    f"{store_name} wird zur Referenz auf seinem Gebiet — mit Ergebnissen, "
                    "die für sich sprechen."
                ),
            },
            {
                "year": "2024",
                "heading": "Zukunft und Innovation",
                "text": (
                    "Gestärkt durch unsere Erfahrung und das Feedback unserer Gemeinschaft "
                    "innovieren wir weiter und erweitern unsere Produktpalette. Unsere Mission "
                    "bleibt dieselbe: die natürliche Schönheit jedes Menschen mit wirksamen, "
                    "sanften und umweltfreundlichen Lösungen zu enthüllen."
                ),
            },
        ],
    }
