"""
Theme modifier — applies AI-generated texts to Shopify theme JSON files.

Strategy: TEXT SURGERY (default) + JSON WRITE (for structural changes)
  • Text surgery: find "field":"old" in raw file → replace with "field":"new"
    → Every byte outside the replaced text is left bit-for-bit identical.
  • JSON write: used ONLY when adding new blocks (e.g. testimonial injection).
    After a JSON write, subsequent text surgery still works against the new file.

DATA SCHEMA (mirrors mock_generator.py and AI prompts):
  homepage     → slogan, welcome, benefits[3], advantages[7], comparison, specs
  product_page → product_benefits[5], product_description, how_it_works,
                 adoption, mini_reviews[3]
  faq          → faq.title + faq.items[5]
  reviews      → reviews[10]
  global_texts → header (timer+marquee), footer (brand_text + optional badges)

PAGE MAPPING:
  Page d'Accueil (templates/index.json):
    Bannière              ← slogan
    Texte enrichi 1       ← welcome.title / welcome.text
    Icônes (3 blocs)      ← benefits[0..2].title / .text
    Image avec texte 1    ← advantages[0].title / .text
    Image avec texte 2    ← advantages[1].title / .text
    Liste de comparaison  ← comparison.title / .description / items[0..4]
    Texte enrichi 2       ← advantages[2].title / .text
    Spécifications        ← specs.title / items[0..3]
    Avis Trustpilot (10)  ← reviews[0..9]
    Contenu réductible    ← faq.title / items[0..4]
    Footer bloc image     ← global_texts.footer.brand_text

  Page Produit (templates/product.json):
    Produit → bloc Icônes (4 icônes)   ← product_benefits[0..3].short_title
    Produit → bloc Témoignages (3)     ← mini_reviews[0..2].name / .text
    Produit → bloc description-faq    ← product_description / how_it_works / adoption
    Image-with-text sections below fold ← advantages[3].title / .text (same for all)
    Liste de comparaison              ← comparison (identique homepage)
    Spécifications                    ← specs (identique homepage)
    Icônes section                    ← benefits (identique homepage)
    Contenu réductible                ← faq (identique homepage)

Shopify field types:
  "inline_richtext" → inline HTML only (<strong>, <em>, <a>, <br>). NO newlines.
  "richtext"        → full block HTML (<p>, <ul>, <li>, <h2>, etc.)
  "text"/"textarea" → plain text
"""
import re
import shutil
import uuid
from pathlib import Path

from app.services.theme.theme_parser import ThemeStructure
from app.services.theme.text_surgery import apply_replacements
from app.utils.json_handler import write_theme_json


# ── Sanitizers ────────────────────────────────────────────────────────────────

def _inline(value: str) -> str:
    """Sanitize for Shopify inline_richtext: strip block tags + newlines."""
    value = re.sub(r"</?(?:p|ul|ol|li|h[1-6]|div)(?:\s[^>]*)?>", "", value)
    value = re.sub(r"[\r\n]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


# ── Public API ─────────────────────────────────────────────────────────────────

def apply_generated_texts(
    structure: ThemeStructure,
    all_results: dict,
    language: str = "fr",
    target_gender: str = "femme",
    store_name: str = "",
) -> set[str]:
    """Apply all generated texts to theme files. Returns set of modified rel-paths."""
    modified: set[str] = set()
    ed = structure.extract_dir
    pf = structure.parsed_files

    hp = all_results.get("homepage", {})
    pp = all_results.get("product_page", {})

    # ── 1. Reviews: JSON injection (must run BEFORE text surgery on index.json)
    if "reviews" in all_results:
        if _inject_testimonials(ed, pf, all_results["reviews"]):
            modified.add("templates/index.json")

    # ── 2. Homepage text surgery
    if hp:
        if _apply_homepage(ed, pf, hp, language, store_name):
            modified.add("templates/index.json")

    # ── 3a. Fix product image-with-text via JSON write (must run BEFORE text surgery)
    if hp:
        if _fix_product_image_with_text(ed, pf, hp):
            modified.add("templates/product.json")

    # ── 3b. Fix accordion headings via JSON write (must run BEFORE text surgery)
    if _fix_product_accordion_headings(ed, pf, language, target_gender):
        modified.add("templates/product.json")

    # ── 3c. Product page text surgery (needs hp for shared sections)
    if pp:
        if _apply_product_page(ed, pf, pp, hp, language, target_gender):
            modified.add("templates/product.json")

    # ── 4. FAQ (both pages)
    if "faq" in all_results:
        for tpl in ("templates/index.json", "templates/product.json"):
            if _apply_faq(ed, pf, tpl, all_results["faq"]):
                modified.add(tpl)

    # ── 5. Story page
    if "story_page" in all_results:
        if _apply_story_page(ed, pf, all_results["story_page"]):
            modified.add("templates/page.story.json")

    # ── 6. Global texts (header + footer + settings)
    if "global_texts" in all_results:
        if _apply_header(ed, pf, all_results["global_texts"], language):
            modified.add("sections/header-group.json")
        if _apply_footer(ed, pf, all_results["global_texts"], language, store_name):
            modified.add("sections/footer-group.json")
        if _apply_settings_data(ed, pf, all_results["global_texts"], language):
            modified.add("config/settings_data.json")

    # ── 7. Tracking page (textes fixes)
    if _apply_tracking_page(ed, pf, language):
        modified.add("templates/page.tracking.json")

    # ── 7b. Contact page (textes fixes)
    if _apply_contact_page(ed, pf, language):
        modified.add("templates/page.contact.json")

    # ── 8. Switch locale files so theme UI is in the chosen language
    _switch_locale_files(ed, language)

    return modified


# ── Navigation helpers (read-only on parsed data) ─────────────────────────────

def _data(parsed_files: dict, rel_path: str) -> dict | None:
    entry = parsed_files.get(rel_path)
    return entry[0] if entry else None


def _section_by_type(data: dict, stype: str) -> tuple[str, dict] | None:
    for sid, sec in data.get("sections", {}).items():
        if sec.get("type") == stype:
            return sid, sec
    return None


def _sections_by_type(data: dict, stype: str) -> list[tuple[str, dict]]:
    order = data.get("order", [])
    return [
        (sid, data["sections"][sid])
        for sid in order
        if data.get("sections", {}).get(sid, {}).get("type") == stype
    ]


def _blocks_in_order(section: dict) -> list[tuple[str, dict]]:
    bo = section.get("block_order", [])
    blks = section.get("blocks", {})
    return [(bid, blks[bid]) for bid in bo if bid in blks]


def _blocks_by_type(section: dict, btype: str) -> list[tuple[str, dict]]:
    return [(bid, blk) for bid, blk in _blocks_in_order(section)
            if blk.get("type") == btype]


def _s(block: dict, key: str) -> str:
    return str(block.get("settings", {}).get(key, ""))


def _rep(reps: list, field: str, old: str, new: str) -> None:
    if old and new and old != new:
        reps.append((field, old, new))


# ── Reviews: JSON injection (adds testimonial blocks up to 10) ────────────────

def _inject_testimonials(ed: Path, pf: dict, rv: dict) -> bool:
    """Inject up to 10 testimonial blocks in reviews-two section via JSON write.

    Called BEFORE text surgery so that the file has the correct block count.
    Updates pf cache so subsequent surgery reads correct old values.
    """
    rel = "templates/index.json"
    entry = pf.get(rel)
    if not entry:
        return False

    data, comment, is_compact = entry
    reviews = rv.get("reviews", [])
    target_count = min(len(reviews), 10)
    if not reviews:
        return False

    modified = False
    for sec in data.get("sections", {}).values():
        if sec.get("type") != "reviews-two":
            continue

        existing = [
            (bid, sec["blocks"][bid])
            for bid in sec.get("block_order", [])
            if bid in sec.get("blocks", {})
            and sec["blocks"][bid].get("type") == "testimonial"
        ]

        # Template settings keys from first existing block (fallback to defaults)
        if existing:
            tmpl = {k: "" for k in existing[0][1].get("settings", {})}
        else:
            tmpl = {
                "title": "", "text": "", "author_name": "",
                "author_age": "", "rating": 5,
            }

        # Add missing blocks
        needed = target_count - len(existing)
        for _ in range(max(0, needed)):
            new_id = uuid.uuid4().hex[:16]
            sec.setdefault("blocks", {})[new_id] = {
                "type": "testimonial",
                "settings": dict(tmpl),
            }
            sec.setdefault("block_order", []).append(new_id)

        # Rebuild full list after potential additions
        existing = [
            (bid, sec["blocks"][bid])
            for bid in sec.get("block_order", [])
            if bid in sec.get("blocks", {})
            and sec["blocks"][bid].get("type") == "testimonial"
        ]

        # Set all values directly in the data dict
        for i, (_, blk) in enumerate(existing[:target_count]):
            r = reviews[i]
            s = blk.setdefault("settings", {})
            s["title"]       = r.get("title", "")
            s["text"]        = f"<p>{r.get('text', '')}</p>"
            s["author_name"] = r.get("name", "")
            s["author_age"]  = str(r.get("age", ""))
            s["rating"]      = r.get("rating", 5)

        modified = True
        break  # Only first reviews-two section

    if modified:
        write_theme_json(ed / rel, data, comment, is_compact)
        pf[rel] = (data, comment, is_compact)

    return modified


# ── Homepage ──────────────────────────────────────────────────────────────────

def _apply_homepage(ed: Path, pf: dict, hp: dict, language: str = "fr", store_name: str = "") -> bool:
    rel = "templates/index.json"
    data = _data(pf, rel)
    if not data:
        return False

    reps: list[tuple[str, str, str]] = []

    _cta_map = {
        "fr": "Découvrir", "en": "Discover", "de": "Entdecken",
        "es": "Descubrir", "pt": "Descobrir", "it": "Scopri",
        "nl": "Ontdekken", "pl": "Odkryj", "ru": "Открыть",
    }
    # Use AI-generated CTA if available, otherwise fall back to map (English if unknown)
    _lang2 = language[:2].lower()
    cta = hp.get("cta_button_text") or _cta_map.get(_lang2, _cta_map["en"])

    # A — Bannière(s): slogan (inline_richtext) + CTA button text
    banner = _section_by_type(data, "banner")
    if banner:
        _, sec = banner
        for _, blk in _blocks_by_type(sec, "heading"):
            _rep(reps, "heading", _s(blk, "heading"),
                 _inline(hp.get("slogan", "")))
            break

    # A2 — All banner / rich-text / image-with-text [button] blocks: CTA text
    if cta:
        for stype in ("banner", "rich-text", "image-with-text"):
            for _, sec in _sections_by_type(data, stype):
                for _, blk in _blocks_by_type(sec, "button"):
                    _rep(reps, "button_text", _s(blk, "button_text"), cta)

    # B — Texte enrichi 1: welcome (heading=inline_richtext, description=richtext)
    _welcome_titles = {
        "fr": f"Bienvenue chez {store_name} !",
        "en": f"Welcome to {store_name}!",
        "de": f"Willkommen bei {store_name}!",
        "es": f"Bienvenido a {store_name}!",
        "pt": f"Bem-vindo à {store_name}!",
        "it": f"Benvenuto su {store_name}!",
        "nl": f"Welkom bij {store_name}!",
        "pl": f"Witamy w {store_name}!",
        "ru": f"Добро пожаловать в {store_name}!",
    }
    _welcome_title = _welcome_titles.get(_lang2, _welcome_titles["en"])
    rich = _sections_by_type(data, "rich-text")
    if rich:
        _, sec = rich[0]
        for _, blk in _blocks_by_type(sec, "heading"):
            _rep(reps, "heading", _s(blk, "heading"), _inline(_welcome_title))
            break
        for _, blk in _blocks_by_type(sec, "text"):
            _rep(reps, "description", _s(blk, "description"),
                 hp.get("welcome", {}).get("text", ""))
            break

    # C — Icônes (3 blocs): benefits
    # heading=plain text, description=inline_richtext
    icons_secs = _sections_by_type(data, "icons")
    if icons_secs:
        _, sec = icons_secs[0]
        benefits = hp.get("benefits", [])
        for i, (_, blk) in enumerate(_blocks_by_type(sec, "icon")):
            if i >= len(benefits):
                break
            _rep(reps, "heading", _s(blk, "heading"),
                 benefits[i].get("title", ""))
            _rep(reps, "description", _s(blk, "description"),
                 _inline(benefits[i].get("text", "")))

    # D — Image avec texte 1 & 2: advantages[0] and advantages[1]
    # heading=inline_richtext, description=richtext
    advantages = hp.get("advantages", [])
    iwt = _sections_by_type(data, "image-with-text")
    for i, (_, sec) in enumerate(iwt[:2]):
        if i >= len(advantages):
            break
        for _, blk in _blocks_by_type(sec, "heading"):
            _rep(reps, "heading", _s(blk, "heading"),
                 _inline(advantages[i].get("title", "")))
            break
        for _, blk in _blocks_by_type(sec, "text"):
            _rep(reps, "description", _s(blk, "description"),
                 advantages[i].get("text", ""))
            break

    # E — Liste de comparaison: comparison
    # section heading=plain, description=inline_richtext; bullet title=plain, tooltip=inline
    comparison = hp.get("comparison", {})
    for _, sec in _sections_by_type(data, "comparaison-list"):
        s = sec.get("settings", {})
        _rep(reps, "heading", str(s.get("heading", "")),
             comparison.get("title", ""))
        _rep(reps, "description", str(s.get("description", "")),
             _inline(comparison.get("description", "")))
        items = comparison.get("items", [])
        for i, (_, blk) in enumerate(_blocks_by_type(sec, "bullet")):
            if i >= len(items):
                break
            _rep(reps, "title",   _s(blk, "title"),
                 items[i].get("feature", ""))
            _rep(reps, "tooltip", _s(blk, "tooltip"),
                 _inline(items[i].get("tooltip", "")))

    # D (cont.) — Texte enrichi 2: advantages[2]
    if len(rich) > 1 and len(advantages) > 2:
        _, sec = rich[1]
        for _, blk in _blocks_by_type(sec, "heading"):
            _rep(reps, "heading", _s(blk, "heading"),
                 _inline(advantages[2].get("title", "")))
            break
        for _, blk in _blocks_by_type(sec, "text"):
            _rep(reps, "description", _s(blk, "description"),
                 advantages[2].get("text", ""))
            break

    # F — Spécifications: specs
    # section heading=plain; spec heading=plain, description=inline_richtext
    specs = hp.get("specs", {})
    for _, ssec in _sections_by_type(data, "specs"):
        _rep(reps, "heading",
             str(ssec.get("settings", {}).get("heading", "")),
             specs.get("title", ""))
        spec_items = specs.get("items", [])
        for i, (_, blk) in enumerate(_blocks_by_type(ssec, "spec")):
            if i >= len(spec_items):
                break
            _rep(reps, "heading", _s(blk, "heading"),
                 spec_items[i].get("title", ""))
            _rep(reps, "description", _s(blk, "description"),
                 _inline(spec_items[i].get("description", "")))

    return apply_replacements(ed / rel, reps) > 0


# ── Product page: JSON write for image-with-text (encoding-safe) ──────────────

def _fix_product_image_with_text(ed: Path, pf: dict, hp: dict) -> bool:
    """Directly write advantages[4] into image-before-after section (encoding-safe).

    Must run BEFORE _apply_product_page / text surgery because the image-before-after
    section may share heading values with image-with-text sections.
    Text surgery would replace the wrong occurrence; JSON write targets the exact dict.

    Updates pf in place so subsequent _apply_product_page sees new==old and skips reps.
    """
    rel = "templates/product.json"
    entry = pf.get(rel)
    if not entry:
        return False

    data, comment, is_compact = entry
    advantages = hp.get("advantages", [])
    if len(advantages) <= 4:
        return False

    adv = advantages[4]  # avantage 5 — même que image-with-text #1
    title = _inline(adv.get("title", ""))
    text = adv.get("text", "")

    if not title and not text:
        return False

    modified = False
    # Apply advantages[4] to image-before-after ONLY
    # Each image-with-text section gets its own advantage (see _apply_product_page)
    for _, sec in _sections_by_type(data, "image-before-after"):
        for _, blk in _blocks_by_type(sec, "heading"):
            s = blk.setdefault("settings", {})
            if s.get("heading") != title:
                s["heading"] = title
                modified = True
            break
        for _, blk in _blocks_by_type(sec, "text"):
            s = blk.setdefault("settings", {})
            if s.get("description") != text:
                s["description"] = text
                modified = True
            break

    if modified:
        write_theme_json(ed / rel, data, comment, is_compact)
        pf[rel] = (data, comment, is_compact)

    return modified


# ── Product page: JSON write for accordion headings (encoding-safe) ───────────

def _fix_product_accordion_headings(ed: Path, pf: dict, language: str = "fr", target_gender: str = "femme") -> bool:
    """Directly write fixed accordion headings into description-faq block (JSON write).

    Uses JSON write (not text surgery) so it works even when heading fields are empty.
    Must run BEFORE _apply_product_page so text surgery sees old==new and skips them.
    """
    rel = "templates/product.json"
    entry = pf.get(rel)
    if not entry:
        return False

    data, comment, is_compact = entry

    _lang2 = language[:2].lower()
    _gender_plural = {
        "homme": {"fr": "hommes", "en": "men", "de": "Männer", "es": "hombres", "pt": "homens", "it": "uomini", "nl": "mannen"},
        "mixte": {"fr": "personnes", "en": "people", "de": "Personen", "es": "personas", "pt": "pessoas", "it": "persone", "nl": "mensen"},
    }.get(target_gender.lower(), {"fr": "femmes", "en": "women", "de": "Frauen", "es": "mujeres", "pt": "mulheres", "it": "donne", "nl": "vrouwen"})
    _plural = _gender_plural.get(_lang2, _gender_plural["en"])
    _fixed = {
        "fr": ("Description", "Comment ça marche ?", f"+9860 {_plural} l'ont déjà adopté !"),
        "en": ("Description", "How does it work?", f"+9860 {_plural} have already adopted it!"),
        "de": ("Beschreibung", "Wie funktioniert es?", f"+9860 {_plural} haben es bereits übernommen!"),
        "es": ("Descripción", "¿Cómo funciona?", f"+9860 {_plural} ya lo han adoptado!"),
        "pt": ("Descrição", "Como funciona?", f"+9860 {_plural} já adotaram!"),
        "it": ("Descrizione", "Come funziona?", f"+9860 {_plural} lo hanno già adottato!"),
        "nl": ("Beschrijving", "Hoe werkt het?", f"+9860 {_plural} hebben het al overgenomen!"),
    }
    h1, h2, h3 = _fixed.get(_lang2, _fixed["en"])

    main = _section_by_type(data, "main-product")
    if not main:
        return False
    _, msec = main

    modified = False
    for _, blk in _blocks_by_type(msec, "description-faq"):
        s = blk.setdefault("settings", {})
        for key, val in [("heading1", h1), ("heading2", h2), ("heading3", h3)]:
            if s.get(key) != val:
                s[key] = val
                modified = True
        break

    if modified:
        write_theme_json(ed / rel, data, comment, is_compact)
        pf[rel] = (data, comment, is_compact)

    return modified


# ── Product page ──────────────────────────────────────────────────────────────

def _apply_product_page(ed: Path, pf: dict, pp: dict, hp: dict, language: str = "fr", target_gender: str = "femme") -> bool:
    """Apply product_page data + shared homepage data to templates/product.json."""
    rel = "templates/product.json"
    data = _data(pf, rel)
    if not data:
        return False

    reps: list[tuple[str, str, str]] = []

    main = _section_by_type(data, "main-product")
    if not main:
        return False
    _, msec = main

    # A — Bloc Icônes dans Produit: icon_1_text..icon_4_text (inline_richtext)
    product_benefits = pp.get("product_benefits", [])
    for _, blk in _blocks_by_type(msec, "icon-with-text"):
        s = blk.get("settings", {})
        for i, pb in enumerate(product_benefits[:4], 1):
            title = pb.get("short_title", "")
            _rep(reps, f"icon_{i}_text",
                 str(s.get(f"icon_{i}_text", "")),
                 f"<strong>{title}</strong>" if title else "")
        break  # Only first icon-with-text block

    # B — Bloc Témoignages dans Produit: heading1-3=name, text1-3=review text
    mini_reviews = pp.get("mini_reviews", [])
    for _, blk in _blocks_by_type(msec, "review"):
        s = blk.get("settings", {})
        for i, r in enumerate(mini_reviews[:3], 1):
            _rep(reps, f"heading{i}", str(s.get(f"heading{i}", "")),
                 r.get("name", ""))
            _rep(reps, f"text{i}", str(s.get(f"text{i}", "")),
                 r.get("text", ""))
        break

    # Fixed accordion headings by language
    _lang = language[:2].lower()
    _gender_plural = {
        "homme": {"fr": "hommes", "en": "men", "de": "Männer", "es": "hombres", "pt": "homens", "it": "uomini", "nl": "mannen"},
        "mixte": {"fr": "personnes", "en": "people", "de": "Personen", "es": "personas", "pt": "pessoas", "it": "persone", "nl": "mensen"},
    }.get(target_gender.lower(), {"fr": "femmes", "en": "women", "de": "Frauen", "es": "mujeres", "pt": "mulheres", "it": "donne", "nl": "vrouwen"})
    _plural = _gender_plural.get(_lang, _gender_plural["en"])
    _fixed_headings = {
        "fr": ("Description", "Comment ça marche ?", f"+9860 {_plural} l'ont déjà adopté !"),
        "en": ("Description", "How does it work?", f"+9860 {_plural} have already adopted it!"),
        "de": ("Beschreibung", "Wie funktioniert es?", f"+9860 {_plural} haben es bereits übernommen!"),
        "es": ("Descripción", "¿Cómo funciona?", f"+9860 {_plural} ya lo han adoptado!"),
        "pt": ("Descrição", "Como funciona?", f"+9860 {_plural} já adotaram!"),
        "it": ("Descrizione", "Come funziona?", f"+9860 {_plural} lo hanno già adottato!"),
        "nl": ("Beschrijving", "Hoe werkt het?", f"+9860 {_plural} hebben het al overgenomen!"),
    }
    h1, h2, h3 = _fixed_headings.get(_lang, _fixed_headings["en"])

    # C/D/E — Bloc description-faq: product_description, how_it_works, adoption
    for _, blk in _blocks_by_type(msec, "description-faq"):
        s = blk.get("settings", {})
        # heading1 = "Description" (fixe)
        _rep(reps, "heading1", str(s.get("heading1", "")), h1)
        if pp.get("product_description"):
            _rep(reps, "text1", str(s.get("text1", "")),
                 pp["product_description"].get("text", ""))
        # heading2 = "Comment ça marche ?" (fixe)
        _rep(reps, "heading2", str(s.get("heading2", "")), h2)
        if pp.get("how_it_works"):
            _rep(reps, "text2", str(s.get("text2", "")),
                 pp["how_it_works"].get("text", ""))
        # heading3 = "+9860 [public] l'ont déjà adopté !" (fixe)
        _rep(reps, "heading3", str(s.get("heading3", "")), h3)
        if pp.get("adoption"):
            _rep(reps, "text3", str(s.get("text3", "")),
                 pp["adoption"].get("text", ""))
        # D4 — Delivery accordion (heading4 / text4)
        di = pp.get("delivery_info", {})
        if di.get("heading"):
            _rep(reps, "heading4", str(s.get("heading4", "")), di["heading"])
        if di.get("text"):
            _rep(reps, "text4", str(s.get("text4", "")), di["text"])
        break

    # D5 — Delivery estimation block labels in main-product
    di = pp.get("delivery_info", {})
    if di:
        for _, blk in _blocks_by_type(msec, "delivery_estimation"):
            bs = blk.get("settings", {})
            if di.get("today_label"):
                _rep(reps, "today_info", str(bs.get("today_info", "")), di["today_label"])
            if di.get("ready_label"):
                _rep(reps, "ready_info", str(bs.get("ready_info", "")), di["ready_label"])
            if di.get("delivered_label"):
                _rep(reps, "delivered_info", str(bs.get("delivered_info", "")), di["delivered_label"])
            break

    # F — Image-with-text sections (3 sections, each gets a different advantage):
    #   image-with-text #1 ← advantages[4]  (5e avantage vendeur)
    #   image-with-text #2 ← advantages[5]  (6e avantage vendeur)
    #   image-with-text #3 ← advantages[6]  (7e avantage vendeur)
    # Note: advantages[3] is handled by _fix_product_image_with_text → image-before-after
    advantages = hp.get("advantages", [])
    iwt_sections = _sections_by_type(data, "image-with-text")
    for i, (_, sec) in enumerate(iwt_sections):
        adv_index = 4 + i  # advantages[4], [5], [6]
        if adv_index >= len(advantages):
            break
        adv = advantages[adv_index]
        for _, blk in _blocks_by_type(sec, "heading"):
            _rep(reps, "heading", _s(blk, "heading"),
                 _inline(adv.get("title", "")))
            break
        for _, blk in _blocks_by_type(sec, "text"):
            _rep(reps, "description", _s(blk, "description"),
                 adv.get("text", ""))
            break

    # G — Liste de comparaison (same as homepage)
    comparison = hp.get("comparison", {})
    for _, sec in _sections_by_type(data, "comparaison-list"):
        s = sec.get("settings", {})
        _rep(reps, "heading", str(s.get("heading", "")),
             comparison.get("title", ""))
        _rep(reps, "description", str(s.get("description", "")),
             _inline(comparison.get("description", "")))
        items = comparison.get("items", [])
        for i, (_, blk) in enumerate(_blocks_by_type(sec, "bullet")):
            if i >= len(items):
                break
            _rep(reps, "title",   _s(blk, "title"),
                 items[i].get("feature", ""))
            _rep(reps, "tooltip", _s(blk, "tooltip"),
                 _inline(items[i].get("tooltip", "")))

    # H — Spécifications: product_specs (spécifiques au produit, différentes de la homepage)
    # Fallback sur hp.get("specs") si product_specs absent (rétrocompat)
    product_specs = pp.get("product_specs") or hp.get("specs", {})
    for _, ssec in _sections_by_type(data, "specs"):
        _rep(reps, "heading",
             str(ssec.get("settings", {}).get("heading", "")),
             product_specs.get("title", ""))
        spec_items = product_specs.get("items", [])
        for i, (_, blk) in enumerate(_blocks_by_type(ssec, "spec")):
            if i >= len(spec_items):
                break
            _rep(reps, "heading", _s(blk, "heading"),
                 spec_items[i].get("title", ""))
            _rep(reps, "description", _s(blk, "description"),
                 _inline(spec_items[i].get("description", "")))

    # I — Icônes section below fold (same benefits as homepage)
    benefits = hp.get("benefits", [])
    for _, isec in _sections_by_type(data, "icons"):
        for i, (_, blk) in enumerate(_blocks_by_type(isec, "icon")):
            if i >= len(benefits):
                break
            _rep(reps, "heading", _s(blk, "heading"),
                 benefits[i].get("title", ""))
            _rep(reps, "description", _s(blk, "description"),
                 _inline(benefits[i].get("text", "")))

    # J — Static section headings (marquee-logo, ugc)
    sh = pp.get("section_headings", {})
    for _, sec in _sections_by_type(data, "marquee-logo"):
        if sh.get("marquee"):
            _rep(reps, "heading", str(sec.get("settings", {}).get("heading", "")),
                 sh["marquee"])
    for _, sec in _sections_by_type(data, "ugc"):
        if sh.get("ugc"):
            _rep(reps, "heading", str(sec.get("settings", {}).get("heading", "")),
                 sh["ugc"])

    # K — main-product text blocks and buy button
    if sh:
        for i, (_, blk) in enumerate(_blocks_by_type(msec, "text")):
            s = blk.get("settings", {})
            old_text = str(s.get("text", ""))
            if i == 0 and sh.get("product_tagline"):
                _rep(reps, "text", old_text, sh["product_tagline"])
            elif i == 1 and sh.get("delivery_promo"):
                _rep(reps, "text", old_text, sh["delivery_promo"])
        for _, blk in _blocks_by_type(msec, "buy_buttons"):
            s = blk.get("settings", {})
            if sh.get("buy_button"):
                _rep(reps, "button_text", str(s.get("button_text", "")), sh["buy_button"])
            break

    return apply_replacements(ed / rel, reps) > 0


# ── FAQ (both pages) ──────────────────────────────────────────────────────────

def _apply_faq(ed: Path, pf: dict, rel: str, faq_data: dict) -> bool:
    """Apply FAQ data to collapsible-content sections.

    Schema: faq_data = {"faq": {"title": str, "items": [{"question": str, "answer": str}]}}
    """
    data = _data(pf, rel)
    if not data:
        return False

    reps: list[tuple[str, str, str]] = []
    faq = faq_data.get("faq", {})
    heading = faq.get("title", "")
    questions = faq.get("items", [])

    for _, sec in _sections_by_type(data, "collapsible-content"):
        if heading:
            _rep(reps, "heading",
                 str(sec.get("settings", {}).get("heading", "")), heading)
        for i, (_, blk) in enumerate(_blocks_by_type(sec, "collapsible_row")):
            if i >= len(questions):
                break
            _rep(reps, "heading", _s(blk, "heading"),
                 questions[i].get("question", ""))
            _rep(reps, "row_content", _s(blk, "row_content"),
                 questions[i].get("answer", ""))

    return apply_replacements(ed / rel, reps) > 0


# ── Story page ────────────────────────────────────────────────────────────────

def _apply_story_page(ed: Path, pf: dict, story: dict) -> bool:
    rel = "templates/page.story.json"
    data = _data(pf, rel)
    if not data:
        return False

    reps: list[tuple[str, str, str]] = []
    tl = _section_by_type(data, "timeline")
    if not tl:
        return False
    _, sec = tl
    s = sec.get("settings", {})

    _rep(reps, "heading",    str(s.get("heading", "")),    story.get("page_heading", ""))
    _rep(reps, "subheading", str(s.get("subheading", "")), story.get("page_subheading", ""))

    events = story.get("timeline_events", [])
    for i, (_, blk) in enumerate(_blocks_by_type(sec, "timeline_event")):
        if i >= len(events):
            break
        _rep(reps, "subheading", _s(blk, "subheading"), events[i].get("year", ""))
        _rep(reps, "heading",    _s(blk, "heading"),    events[i].get("heading", ""))
        _rep(reps, "text",       _s(blk, "text"),       events[i].get("text", ""))

    return apply_replacements(ed / rel, reps) > 0


# ── Tracking page ─────────────────────────────────────────────────────────────

def _apply_tracking_page(ed: Path, pf: dict, language: str = "fr") -> bool:
    """Apply fixed tracking page texts to templates/page.tracking.json."""
    rel = "templates/page.tracking.json"
    data = _data(pf, rel)
    if not data:
        return False

    _lang2 = language[:2].lower()
    _texts = {
        "fr": ("Suivre ma commande", "Entrez le numéro de votre commande pour connaître sa position actuelle.", "Suivre", "Numéro de suivi de commande"),
        "en": ("Track my order", "Enter your order number to find out its current location.", "Track", "Order tracking number"),
        "de": ("Meine Bestellung verfolgen", "Geben Sie Ihre Bestellnummer ein, um den aktuellen Status zu sehen.", "Verfolgen", "Sendungsverfolgungsnummer"),
        "es": ("Seguir mi pedido", "Introduce el número de tu pedido para conocer su ubicación actual.", "Seguir", "Número de seguimiento del pedido"),
        "pt": ("Rastrear meu pedido", "Insira o número do seu pedido para saber a sua localização atual.", "Rastrear", "Número de rastreamento do pedido"),
        "it": ("Traccia il mio ordine", "Inserisci il numero del tuo ordine per conoscere la sua posizione attuale.", "Traccia", "Numero di tracciamento dell'ordine"),
        "nl": ("Volg mijn bestelling", "Voer uw bestelnummer in om de huidige locatie te weten.", "Volgen", "Bestelling trackingnummer"),
    }
    heading, description, button, track = _texts.get(_lang2, _texts["en"])

    reps: list[tuple[str, str, str]] = []

    for _, sec in data.get("sections", {}).items():
        if sec.get("type") != "main-tracking":
            continue
        s = sec.get("settings", {})
        _rep(reps, "heading",     str(s.get("heading", "")),     heading)
        _rep(reps, "description", str(s.get("description", "")), description)
        _rep(reps, "button_text", str(s.get("button_text", "")), button)
        _rep(reps, "track",       str(s.get("track", "")),       track)
        # Subheading toujours vide — _rep ignore new="", utiliser append direct
        old_subheading = str(s.get("subheading", ""))
        if old_subheading:
            reps.append(("subheading", old_subheading, ""))

    return apply_replacements(ed / rel, reps) > 0


# ── Contact page ───────────────────────────────────────────────────────────────

def _apply_contact_page(ed: Path, pf: dict, language: str = "fr") -> bool:
    """Apply fixed contact page texts to templates/page.contact.json."""
    rel = "templates/page.contact.json"
    data = _data(pf, rel)
    if not data:
        return False

    _lang2 = language[:2].lower()
    _texts = {
        "fr": ("Numéro de Commande", "Envoyez"),
        "en": ("Order Number", "Send"),
        "de": ("Bestellnummer", "Senden"),
        "es": ("Número de Pedido", "Enviar"),
        "pt": ("Número do Pedido", "Enviar"),
        "it": ("Numero Ordine", "Invia"),
        "nl": ("Bestelnummer", "Versturen"),
    }
    order_number, button_text = _texts.get(_lang2, _texts["en"])

    reps: list[tuple[str, str, str]] = []

    for _, sec in data.get("sections", {}).items():
        if sec.get("type") != "contact-form":
            continue
        s = sec.get("settings", {})
        # Vider la description (cas spécial : new="" ignoré par _rep)
        old_desc = str(s.get("description", ""))
        if old_desc:
            reps.append(("description", old_desc, ""))
        _rep(reps, "order_number", str(s.get("order_number", "")), order_number)
        _rep(reps, "button_text",  str(s.get("button_text", "")),  button_text)

    return apply_replacements(ed / rel, reps) > 0


# ── Header ────────────────────────────────────────────────────────────────────

def _apply_header(ed: Path, pf: dict, gt: dict, language: str = "fr") -> bool:
    rel = "sections/header-group.json"
    data = _data(pf, rel)
    if not data:
        return False

    reps: list[tuple[str, str, str]] = []
    header = gt.get("header", {})

    _lang2 = language[:2].lower()
    _timer_texts = {
        "fr": "NOTRE OFFRE : 1 ACHETÉ, LE 2ᵉ À -50 % PENDANT",
        "en": "OUR OFFER: BUY 1, GET THE 2ND AT -50% FOR",
        "de": "UNSER ANGEBOT: 1 GEKAUFT, DAS 2. FÜR -50 % FÜR",
        "es": "NUESTRA OFERTA: COMPRA 1, EL 2º AL -50% DURANTE",
        "pt": "NOSSA OFERTA: COMPRE 1, O 2º A -50% POR",
        "it": "LA NOSTRA OFFERTA: ACQUISTA 1, IL 2° A -50% PER",
        "nl": "ONS AANBOD: KOOP 1, DE 2E VOOR -50% GEDURENDE",
    }
    _timer_text = _timer_texts.get(_lang2, _timer_texts["en"])

    for _, sec in data.get("sections", {}).items():
        if sec.get("type") != "announcement-bar":
            continue
        for _, blk in sec.get("blocks", {}).items():
            btype = blk.get("type", "")
            if btype == "announcement-timer":
                _rep(reps, "text", _s(blk, "text"), _inline(_timer_text))
            elif btype == "announcement-marquee":
                _marquee_texts = {
                    "fr": "PLUS DE 9860 PERSONNES NOUS RECOMMANDENT",
                    "en": "MORE THAN 9860 PEOPLE RECOMMEND US",
                    "de": "MEHR ALS 9860 PERSONEN EMPFEHLEN UNS",
                    "es": "MÁS DE 9860 PERSONAS NOS RECOMIENDAN",
                    "pt": "MAIS DE 9860 PESSOAS NOS RECOMENDAM",
                    "it": "PIÙ DI 9860 PERSONE CI RACCOMANDANO",
                    "nl": "MEER DAN 9860 MENSEN BEVELEN ONS AAN",
                }
                _rep(reps, "text", _s(blk, "text"),
                     _inline(_marquee_texts.get(_lang2, _marquee_texts["en"])))

    return apply_replacements(ed / rel, reps) > 0


# ── Footer ────────────────────────────────────────────────────────────────────

def _apply_footer(ed: Path, pf: dict, gt: dict, language: str = "fr", store_name: str = "") -> bool:
    """Apply footer texts.

    Always updates: footer image block text_footer (À propos / brand_text).
    Newsletter heading is always fixed: "REJOIGNEZ L'ÉQUIPE [STORE_NAME] !" (translated).
    """
    rel = "sections/footer-group.json"
    data = _data(pf, rel)
    if not data:
        return False

    _lang2 = language[:2].lower()
    _store_upper = store_name.upper() if store_name else ""
    _newsletter_headings = {
        "fr": f"REJOIGNEZ L'ÉQUIPE {_store_upper} !",
        "en": f"JOIN THE {_store_upper} TEAM!",
        "de": f"WERDEN SIE TEIL DES TEAMS {_store_upper}!",
        "es": f"¡ÚNETE AL EQUIPO {_store_upper}!",
        "pt": f"JUNTE-SE À EQUIPE {_store_upper}!",
        "it": f"UNISCITI AL TEAM {_store_upper}!",
        "nl": f"WORD LID VAN HET TEAM {_store_upper}!",
    }
    _newsletter_heading = _newsletter_headings.get(_lang2, _newsletter_headings["en"])

    reps: list[tuple[str, str, str]] = []
    footer = gt.get("footer", {})

    for _, sec in data.get("sections", {}).items():
        stype = sec.get("type", "")

        if stype == "icons":
            # Trust badges — icons.description is inline_richtext
            badges = footer.get("trust_badges", [])
            for i, (_, blk) in enumerate(_blocks_by_type(sec, "icon")):
                if i >= len(badges):
                    break
                b = badges[i]
                if b.get("heading"):
                    _rep(reps, "heading", _s(blk, "heading"),
                         b["heading"])
                if b.get("description"):
                    _rep(reps, "description", _s(blk, "description"),
                         _inline(b["description"]))

        elif stype == "footer":
            link_idx = 0
            for _, blk in _blocks_in_order(sec):
                btype = blk.get("type", "")

                if btype == "image":
                    # brand_text (À propos) — text_footer is richtext
                    if footer.get("brand_text"):
                        _rep(reps, "text_footer", _s(blk, "text_footer"),
                             footer["brand_text"])

                elif btype == "newsletter":
                    # Heading toujours fixe : "REJOIGNEZ L'ÉQUIPE [STORE] !"
                    if _newsletter_heading:
                        _rep(reps, "heading", _s(blk, "heading"), _newsletter_heading)
                    if footer.get("newsletter_text"):
                        _rep(reps, "text", _s(blk, "text"),
                             _inline(footer["newsletter_text"]))

                elif btype == "link_list":
                    headings = footer.get("link_list_headings", [])
                    if link_idx < len(headings) and headings[link_idx]:
                        _rep(reps, "heading", _s(blk, "heading"),
                             headings[link_idx])
                    link_idx += 1

    return apply_replacements(ed / rel, reps) > 0


# ── Settings data (cart drawer + global UI texts) ─────────────────────────────

def _apply_settings_data(ed: Path, pf: dict, gt: dict, language: str = "fr") -> bool:
    """Apply cart/UI text translations to config/settings_data.json.

    Handles top-level current.* fields and the cart-drawer section settings.
    Fixed translations are applied for timer block and delivery estimation labels.
    """
    rel = "config/settings_data.json"
    data = _data(pf, rel)
    if not data:
        return False

    _lang2 = language[:2].lower()

    # Fixed translations for cart-drawer blocks
    _timer_texts = {
        "fr": "Bénéficiez d'une réduction supplémentaire de 10 % pendant $time",
        "en": "Enjoy an extra 10% discount for $time",
        "de": "Genießen Sie 10% zusätzlichen Rabatt für $time",
        "es": "Disfruta de un 10% de descuento adicional durante $time",
        "pt": "Aproveite 10% de desconto adicional por $time",
        "it": "Approfitta di uno sconto extra del 10% per $time",
        "nl": "Geniet van 10% extra korting gedurende $time",
    }
    _delivery_labels = {
        "fr": ("Commande", "Commande Prête", "Livraison"),
        "en": ("Order", "Order Ready", "Delivery"),
        "de": ("Bestellung", "Bestellung Bereit", "Lieferung"),
        "es": ("Pedido", "Pedido Listo", "Entrega"),
        "pt": ("Pedido", "Pedido Pronto", "Entrega"),
        "it": ("Ordine", "Ordine Pronto", "Consegna"),
        "nl": ("Bestelling", "Bestelling Klaar", "Levering"),
    }
    _upsell_titles = {
        "fr": "Vous allez adorer cet article",
        "en": "You'll love this item",
        "de": "Das werden Sie lieben",
        "es": "Te encantará este artículo",
        "pt": "Você vai adorar este item",
        "it": "Amerai questo articolo",
        "nl": "Je zult dit artikel geweldig vinden",
    }
    _savings = {
        "fr": "Vous économisez",
        "en": "You save",
        "de": "Sie sparen",
        "es": "Ahorras",
        "pt": "Você economiza",
        "it": "Risparmi",
        "nl": "U bespaart",
    }
    _subtotal = {
        "fr": "Sous-Total",
        "en": "Subtotal",
        "de": "Zwischensumme",
        "es": "Subtotal",
        "pt": "Subtotal",
        "it": "Subtotale",
        "nl": "Subtotaal",
    }
    _total = {
        "fr": "Total",
        "en": "Total",
        "de": "Gesamt",
        "es": "Total",
        "pt": "Total",
        "it": "Totale",
        "nl": "Totaal",
    }
    _upsell_btn = {
        "fr": "Ajouter",
        "en": "Add",
        "de": "Hinzufügen",
        "es": "Agregar",
        "pt": "Adicionar",
        "it": "Aggiungi",
        "nl": "Toevoegen",
    }
    _protection = {
        "fr": "Protégez votre commande contre les dommages, la perte ou le vol.",
        "en": "Protect your order against damage, loss or theft.",
        "de": "Schützen Sie Ihre Bestellung gegen Beschädigung, Verlust oder Diebstahl.",
        "es": "Proteja su pedido contra daños, pérdida o robo.",
        "pt": "Proteja seu pedido contra danos, perda ou roubo.",
        "it": "Proteggi il tuo ordine da danni, perdita o furto.",
        "nl": "Bescherm uw bestelling tegen schade, verlies of diefstal.",
    }
    _cart_footer = {
        "fr": "<strong>⭐4.8/5 Trustpilot | 🔐 Paiement Sécurisé</strong>",
        "en": "<strong>⭐4.8/5 Trustpilot | 🔐 Secure Payment</strong>",
        "de": "<strong>⭐4.8/5 Trustpilot | 🔐 Sichere Zahlung</strong>",
        "es": "<strong>⭐4.8/5 Trustpilot | 🔐 Pago Seguro</strong>",
        "pt": "<strong>⭐4.8/5 Trustpilot | 🔐 Pagamento Seguro</strong>",
        "it": "<strong>⭐4.8/5 Trustpilot | 🔐 Pagamento Sicuro</strong>",
        "nl": "<strong>⭐4.8/5 Trustpilot | 🔐 Veilige Betaling</strong>",
    }
    _timeout = {
        "fr": "Offre expirée",
        "en": "Offer expired",
        "de": "Angebot abgelaufen",
        "es": "Oferta expirada",
        "pt": "Oferta expirada",
        "it": "Offerta scaduta",
        "nl": "Aanbieding verlopen",
    }
    _product_card_btn = {
        "fr": "Ajouter au panier",
        "en": "Add to cart",
        "de": "In den Warenkorb",
        "es": "Agregar al carrito",
        "pt": "Adicionar ao carrinho",
        "it": "Aggiungi al carrello",
        "nl": "In winkelwagen",
    }

    timer_text = _timer_texts.get(_lang2, _timer_texts["en"])
    today, ready, delivered = _delivery_labels.get(_lang2, _delivery_labels["en"])

    reps: list[tuple[str, str, str]] = []
    cart = gt.get("cart", {})
    settings_txt = gt.get("settings", {})
    cur = data.get("current", {})

    # Top-level settings (fixed translations, AI override if present)
    _rep(reps, "product_card_button_text",
         str(cur.get("product_card_button_text", "")),
         settings_txt.get("product_card_button_text") or _product_card_btn.get(_lang2, _product_card_btn["en"]))
    _rep(reps, "timer_timeout_text",
         str(cur.get("timer_timeout_text", "")),
         settings_txt.get("timer_timeout_text") or _timeout.get(_lang2, _timeout["en"]))

    # Cart-drawer section
    for _, sec in cur.get("sections", {}).items():
        if sec.get("type") != "cart-drawer":
            continue
        s = sec.get("settings", {})

        # Cart settings: use AI data if available, else fixed translation
        _rep(reps, "cart_upsell_title",      str(s.get("cart_upsell_title", "")),
             cart.get("upsell_title") or _upsell_titles.get(_lang2, _upsell_titles["en"]))
        _rep(reps, "cart_upsell_button_text", str(s.get("cart_upsell_button_text", "")),
             cart.get("upsell_button_text") or _upsell_btn.get(_lang2, _upsell_btn["en"]))
        _rep(reps, "cart_protection_text",    str(s.get("cart_protection_text", "")),
             cart.get("protection_text") or _protection.get(_lang2, _protection["en"]))
        _rep(reps, "cart_savings_text",       str(s.get("cart_savings_text", "")),
             cart.get("savings_text") or _savings.get(_lang2, _savings["en"]))
        _rep(reps, "cart_subtotal_text",      str(s.get("cart_subtotal_text", "")),
             cart.get("subtotal_text") or _subtotal.get(_lang2, _subtotal["en"]))
        _rep(reps, "cart_total_text",         str(s.get("cart_total_text", "")),
             cart.get("total_text") or _total.get(_lang2, _total["en"]))
        _rep(reps, "cart_footer_text",        str(s.get("cart_footer_text", "")),
             cart.get("cart_footer_text") or _cart_footer.get(_lang2, _cart_footer["en"]))
        if cart.get("button_text"):
            _rep(reps, "cart_button_text", str(s.get("cart_button_text", "")), cart["button_text"])

        # Blocks: timer text (fixed) + delivery estimation (fixed)
        for _, blk in _blocks_in_order(sec):
            btype = blk.get("type", "")
            bs = blk.get("settings", {})
            if btype == "timer":
                _rep(reps, "text", str(bs.get("text", "")), timer_text)
            elif btype == "delivery_estimation":
                _rep(reps, "today_info",    str(bs.get("today_info", "")),    today)
                _rep(reps, "ready_info",    str(bs.get("ready_info", "")),    ready)
                _rep(reps, "delivered_info", str(bs.get("delivered_info", "")), delivered)

        break  # Only first cart-drawer section

    return apply_replacements(ed / rel, reps) > 0


# ── Locale file switching ─────────────────────────────────────────────────────

def _switch_locale_files(ed: Path, language: str) -> None:
    """Switch the theme's default storefront locale to the chosen language.

    Storefront locale files (*.json):
      1. Demote en.default.json → en.json
      2. Promote {lang}.json → {lang}.default.json

    Schema locale files (*.schema.json — theme EDITOR admin labels):
      The target language schema file is often incomplete (not all keys translated).
      To avoid "missing translation: t:..." errors in the Shopify theme editor,
      we create {lang}.default.schema.json as a COPY of en.default.schema.json.
      This guarantees every admin label key exists (in English as fallback).
      No JSON parsing needed — raw bytes copy preserves the original format.

    No-op for English or if the target locale file doesn't exist in the theme.
    """
    lang = language.lower()
    if lang.startswith("en"):
        return

    locales_dir = ed / "locales"
    if not locales_dir.exists():
        return

    # Try exact code, then primary subtag (e.g. "fr" from "fr-FR")
    target_code: str | None = None
    for code in ([lang, lang.split("-")[0]] if "-" in lang else [lang]):
        if (locales_dir / f"{code}.json").exists():
            target_code = code
            break

    if not target_code:
        return

    # Demote English storefront default
    en_def = locales_dir / "en.default.json"
    en_dem = locales_dir / "en.json"
    if en_def.exists() and not en_dem.exists():
        en_def.rename(en_dem)

    # Promote target storefront locale to default
    t_json = locales_dir / f"{target_code}.json"
    t_def  = locales_dir / f"{target_code}.default.json"
    if t_json.exists() and not t_def.exists():
        t_json.rename(t_def)

    # Create {lang}.default.schema.json from en.default.schema.json so the
    # Shopify admin (in any language) always finds every schema label key.
    # The target language schema (e.g. fr.schema.json) is often incomplete;
    # using English as the base prevents all "missing translation: t:..." errors.
    en_schema = locales_dir / "en.default.schema.json"
    t_def_schema = locales_dir / f"{target_code}.default.schema.json"
    if en_schema.exists() and not t_def_schema.exists():
        import shutil
        shutil.copy2(en_schema, t_def_schema)
