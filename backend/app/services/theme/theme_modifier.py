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
    Avis Trustpilot (80)  ← reviews[0..79] (reviews-two, créée avec 80 blocs si absente)
    Contenu réductible    ← faq.title / items[0..4]
    Footer bloc image     ← global_texts.footer.brand_text

  Page Produit (templates/product.json):
    Avis clients (80)                  ← reviews[0..79] (reviews, créée avec 80 blocs si absente)
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
import json
import re
import shutil
import uuid
from pathlib import Path

from app.services.theme.theme_parser import ThemeStructure
from app.services.theme.text_surgery import apply_replacements
from app.utils.json_handler import write_theme_json


# ── Shopify locale file header ────────────────────────────────────────────────
# All Shopify locale files (*.json, *.schema.json) carry this comment block.
# It is present in every file of the original Story-theme and must be preserved
# in any file we write — Shopify's theme validator expects it.
_SHOPIFY_LOCALE_HEADER = (
    "/*\n"
    " * ------------------------------------------------------------\n"
    " * IMPORTANT: The contents of this file are auto-generated.\n"
    " *\n"
    " * This file may be updated by the Shopify admin language editor\n"
    " * or related systems. Please exercise caution as any changes\n"
    " * made to this file may be overwritten.\n"
    " * ------------------------------------------------------------\n"
    " */\n"
)


# ── Sanitizers ────────────────────────────────────────────────────────────────

def _inline(value: str) -> str:
    """Sanitize for Shopify inline_richtext: strip block tags + newlines."""
    value = re.sub(r"</?(?:p|ul|ol|li|h[1-6]|div)(?:\s[^>]*)?>", "", value)
    value = re.sub(r"[\r\n]+", " ", value)
    value = re.sub(r"\s+", " ", value).strip()
    return value


def _sanitize_richtext(value: str) -> str:
    """Sanitize for Shopify richtext: keep only valid block HTML, strip all else.

    Allowed tags: <p>, <strong>, <em>, <ul>, <ol>, <li>, <br>, <a href="...">
    Strips: <summary>, <details>, <div>, <span>, <section>, <aside>, all attrs
    except href on <a>. Guards against AI-generated or scraped Shopify HTML.
    Also enforces a 2000-char max to prevent bloated injections.
    """
    if not value:
        return value

    # Strip any tag that is NOT in the allowed set (including summary, details, div, span…)
    # First pass: strip attributes from allowed tags (keep only href on <a>)
    value = re.sub(r'<(strong|em|p|ul|ol|li|br)\s[^>]*>', r'<\1>', value, flags=re.IGNORECASE)
    value = re.sub(r'<a\s[^>]*href=["\']([^"\']*)["\'][^>]*>', r'<a href="\1">', value, flags=re.IGNORECASE)
    value = re.sub(r'<a\s(?!href)[^>]*>', '<a>', value, flags=re.IGNORECASE)

    # Second pass: remove disallowed tags entirely (tag + content for block-level ones)
    DISALLOWED_BLOCK = r'summary|details|div|span|section|aside|header|footer|nav|article|figure|figcaption|table|tr|td|th|thead|tbody|form|input|button|select|option|script|style|iframe|template'
    value = re.sub(rf'</?(?:{DISALLOWED_BLOCK})\b[^>]*>', '', value, flags=re.IGNORECASE)

    # Remove any remaining unknown/stray tags (anything not in our allowed set)
    ALLOWED_TAGS = r'p|strong|em|ul|ol|li|br|a'
    value = re.sub(rf'</?(?!(?:{ALLOWED_TAGS})\b)\w+[^>]*>', '', value, flags=re.IGNORECASE)

    # Clean up whitespace
    value = re.sub(r'[ \t]+', ' ', value)
    value = re.sub(r'\n{3,}', '\n\n', value).strip()

    # Enforce max length: 2000 chars to avoid gigantic injections
    if len(value) > 2000:
        # Truncate at last complete </p> within limit
        truncated = value[:1996]  # leave room for closing </p>
        last_p = truncated.rfind('</p>')
        if last_p > 200:
            value = truncated[:last_p + 4]
        else:
            value = truncated.rstrip() + '</p>'

    return value


# ── Public API ─────────────────────────────────────────────────────────────────

def _apply_colors(ed: Path, pf: dict, colors_data: dict) -> bool:
    """Apply user-edited color_schemes to config/settings_data.json.

    colors_data format: {"color_schemes": {"background-1": {"settings": {...}}, ...}}
    Updates existing schemes and creates new ones (inheriting gradient/non-editable
    fields from the first existing scheme as a base).
    Uses JSON write — must be called BEFORE text surgery on settings_data.json.
    """
    rel = "config/settings_data.json"
    entry = pf.get(rel)
    if not entry:
        return False

    data, comment, is_compact = entry
    user_schemes = colors_data.get("color_schemes", {})
    if not user_schemes:
        return False

    cur = data.get("current", {})
    theme_schemes = cur.get("color_schemes", {})
    if not theme_schemes:
        return False

    editable_fields = {"background", "background_secondary", "text", "text_secondary", "accent-1", "accent-2"}
    modified = False

    # Pre-compute base settings for new schemes (copy from first existing scheme)
    base_settings: dict = {}
    if theme_schemes:
        first_key = next(iter(theme_schemes))
        base_settings = dict(theme_schemes[first_key].get("settings", {}))

    for key, user_scheme in user_schemes.items():
        if key not in theme_schemes:
            # New scheme: inherit gradient/non-editable fields from first existing scheme
            theme_schemes[key] = {"settings": dict(base_settings)}
        user_settings = user_scheme.get("settings", {})
        theme_settings = theme_schemes[key].setdefault("settings", {})
        for field, value in user_settings.items():
            if field in editable_fields and isinstance(value, str) and value.startswith("#"):
                theme_settings[field] = value
        modified = True

    if not modified:
        return False

    write_theme_json(ed / rel, data, comment, is_compact)
    pf[rel] = (data, comment, is_compact)
    return True


def _remove_invalid_template_blocks(ed: Path) -> int:
    """Remove blocks from template JSONs that reference block types undefined in their section schema.

    Story Theme 3.5.0 ships with product.json containing a 'social_proof' block in
    the main-product section, but the 3.5.0 main-product.liquid no longer defines that
    block type. Shopify rejects the product template when an unknown block type is present,
    causing a 404 on the product page. This function fixes that inconsistency for any
    base theme version.
    """
    sections_dir = ed / "sections"
    templates_dir = ed / "templates"
    if not sections_dir.exists() or not templates_dir.exists():
        return 0

    # Build map: section_filename_stem → set of valid block types from schema
    valid_block_types: dict[str, set[str]] = {}
    for section_file in sections_dir.glob("*.liquid"):
        try:
            content = section_file.read_text(encoding="utf-8", errors="replace")
            m = re.search(r"\{%-?\s*schema\s*-?%\}(.*?)\{%-?\s*endschema\s*-?%\}", content, re.DOTALL)
            if not m:
                continue
            schema = json.loads(m.group(1).strip())
            block_types = {b["type"] for b in schema.get("blocks", []) if "type" in b}
            valid_block_types[section_file.stem] = block_types
        except Exception:
            continue

    total_removed = 0
    for template_file in templates_dir.glob("*.json"):
        try:
            raw = template_file.read_text(encoding="utf-8")
            data = json.loads(raw)
            changed = False

            for _sec_key, sec_data in data.get("sections", {}).items():
                section_type = sec_data.get("type", "")
                if section_type not in valid_block_types:
                    continue
                valid = valid_block_types[section_type]
                blocks = sec_data.get("blocks", {})
                bad_keys = [k for k, v in blocks.items() if v.get("type") not in valid]
                if bad_keys:
                    for k in bad_keys:
                        del blocks[k]
                    # Also prune blocks_order if present
                    if "blocks_order" in sec_data:
                        sec_data["blocks_order"] = [o for o in sec_data["blocks_order"] if o not in bad_keys]
                    total_removed += len(bad_keys)
                    changed = True

            if changed:
                json_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
                json_str = json_str.replace("/", "\\/")
                template_file.write_text(json_str, encoding="utf-8")
        except Exception:
            continue

    return total_removed


# ── Universal theme reconstruction ────────────────────────────────────────────

_STORY_SIGNATURE_SECTIONS = {"comparaison-list", "specs", "icons", "ugc"}
_REFERENCE_DIR = Path(__file__).parent.parent.parent / "theme_reference"


def _is_story_structure(ed: Path) -> bool:
    """Return True if this theme already has Story-compatible product.json structure.

    A theme is considered Story-compatible when its product.json contains all four
    signature section types used by the Story Theme family.
    """
    product_json = ed / "templates" / "product.json"
    if not product_json.exists():
        return False
    try:
        data = json.loads(product_json.read_text(encoding="utf-8"))
        section_types = {s.get("type", "") for s in data.get("sections", {}).values()}
        return _STORY_SIGNATURE_SECTIONS.issubset(section_types)
    except Exception:
        return False


def _rebuild_to_story_structure(ed: Path) -> bool:
    """Rebuild index.json and product.json to match Story Theme structure.

    Uses the uploaded theme's own Liquid section files — only copies truly missing
    Liquid files (e.g. reviews-two.liquid) from the reference bundle.
    Returns True if any files were written.
    """
    changed = False
    templates_dir = ed / "templates"
    sections_dir = ed / "sections"

    # ── 1. Copy reference template JSONs ─────────────────────────────────────
    for tmpl_name in ("index.json", "product.json"):
        ref_file = _REFERENCE_DIR / "templates" / tmpl_name
        if not ref_file.exists():
            continue
        target = templates_dir / tmpl_name
        shutil.copy2(ref_file, target)
        changed = True

    # ── 2. Copy only missing Liquid section files from reference ─────────────
    ref_sections = _REFERENCE_DIR / "sections"
    if ref_sections.exists():
        for ref_liquid in ref_sections.glob("*.liquid"):
            target = sections_dir / ref_liquid.name
            if not target.exists():
                shutil.copy2(ref_liquid, target)
                changed = True

    return changed


def apply_generated_texts(
    structure: ThemeStructure,
    all_results: dict,
    language: str = "fr",
    target_gender: str = "femme",
    store_name: str = "",
    delivery_delay: str = "",
    return_policy_days: str = "30",
) -> set[str]:
    """Apply all generated texts to theme files. Returns set of modified rel-paths."""
    modified: set[str] = set()
    ed = structure.extract_dir
    pf = structure.parsed_files

    hp = all_results.get("homepage", {})
    pp = all_results.get("product_page", {})

    # AI-generated UI labels for languages outside the 13 hardcoded ones.
    # For the 13 fully-localised languages, global_texts.ui is {} and ai_ui stays empty.
    ai_ui = all_results.get("global_texts", {}).get("ui", {})

    # ── 0. Colors: JSON write on settings_data.json (MUST run before text surgery on same file)
    if "colors" in all_results:
        if _apply_colors(ed, pf, all_results["colors"]):
            modified.add("config/settings_data.json")

    # ── 1. Reviews: JSON injection (must run BEFORE text surgery on index/product)
    if "reviews" in all_results:
        for rel in _inject_testimonials(ed, pf, all_results["reviews"], language=language, ai_ui=ai_ui):
            modified.add(rel)

    # ── 1b. Remove invalid blocks AFTER all JSON writes (so pf cache is current)
    # Shopify rejects templates with unknown block types (e.g. cross_sell dropped in Story 3.5.0)
    _remove_invalid_template_blocks(ed)

    # ── 2. Homepage text surgery
    if hp:
        if _apply_homepage(ed, pf, hp, language, store_name):
            modified.add("templates/index.json")

    # ── 3a. Fix product image-with-text via JSON write (must run BEFORE text surgery)
    if hp:
        if _fix_product_image_with_text(ed, pf, hp):
            modified.add("templates/product.json")

    # ── 3b. Fix accordion headings via JSON write (must run BEFORE text surgery)
    if _fix_product_accordion_headings(ed, pf, language, target_gender, ai_ui=ai_ui):
        modified.add("templates/product.json")

    # ── 3c. Product page text surgery (needs hp for shared sections)
    if pp:
        if _apply_product_page(ed, pf, pp, hp, language, target_gender, delivery_delay, return_policy_days, ai_ui=ai_ui):
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
        if _apply_header(ed, pf, all_results["global_texts"], language, ai_ui=ai_ui):
            modified.add("sections/header-group.json")
        if _apply_footer(ed, pf, all_results["global_texts"], language, store_name, ai_ui=ai_ui):
            modified.add("sections/footer-group.json")
        if _apply_settings_data(ed, pf, all_results["global_texts"], language, ai_ui=ai_ui):
            modified.add("config/settings_data.json")

    # ── 7. Tracking page (textes fixes)
    if _apply_tracking_page(ed, pf, language, ai_ui=ai_ui):
        modified.add("templates/page.tracking.json")

    # ── 7b. Contact page (textes fixes)
    if _apply_contact_page(ed, pf, language, ai_ui=ai_ui):
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
    order = data.get("order") or list(data.get("sections", {}).keys())
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
    val = block.get("settings", {}).get(key, "")
    return "" if val is None else str(val)


def _rep(reps: list, field: str, old: str, new: str) -> None:
    if new and old != new:
        reps.append((field, old, new))


# ── Reviews: JSON injection (Avis Trustpilot + Avis) ─────────────────────────

_REVIEWS_TWO_HEADING = {
    "fr": "Ils en parlent mieux que nous",
    "en": "They speak better about us than we do",
    "de": "Sie sprechen besser über uns als wir selbst",
    "da": "De taler bedre om os end vi selv",
    "sv": "De talar bättre om oss än vi själva",
    "no": "De snakker bedre om oss enn vi gjør selv",
    "fi": "He puhuvat meistä paremmin kuin me itse",
    "es": "Ellos hablan mejor de nosotros que nosotros mismos",
    "pt": "Eles falam melhor de nós do que nós mesmos",
    "it": "Parlano di noi meglio di quanto facciamo noi",
    "nl": "Ze spreken beter over ons dan wijzelf",
    "pl": "Mówią o nas lepiej niż my sami",
    "ru": "Они говорят о нас лучше, чем мы сами",
}

_REVIEWS_HEADING = {
    "fr": "Avis clients",
    "en": "Customer Reviews",
    "de": "Kundenbewertungen",
    "da": "Kundeanmeldelser",
    "sv": "Kundrecensioner",
    "no": "Kundeanmeldelser",
    "fi": "Asiakasarvostelut",
    "es": "Reseñas de clientes",
    "pt": "Avaliações de clientes",
    "it": "Recensioni clienti",
    "nl": "Klantbeoordelingen",
    "pl": "Opinie klientów",
    "ru": "Отзывы покупателей",
}


def _inject_index_reviews(ed: Path, pf: dict, reviews: list, language: str, ai_ui: dict = {}) -> bool:
    """Inject 10 image + 20 text review blocks into a 'reviews' section in index.json.

    The section is placed just above the reviews-two (Trustpilot) section.
    """
    entry = pf.get("templates/index.json")
    if not entry:
        return False

    data, comment, is_compact = entry

    found_sec = None
    for sec in data.get("sections", {}).values():
        if sec.get("type") == "reviews":
            found_sec = sec
            break

    if found_sec is not None:
        # Update heading in existing section to match the selected language
        if found_sec.get("settings") is not None:
            _h = _REVIEWS_HEADING.get(language) or ai_ui.get("reviews_heading") or _REVIEWS_HEADING["en"]
            if _h:
                found_sec["settings"]["heading"] = _h
        _fill_index_reviews_mixed_blocks(found_sec, reviews)
    else:
        new_id = f"reviews_{uuid.uuid4().hex[:8]}"
        new_sec = _make_review_section(
            "reviews", "text", reviews, _INDEX_REVIEWS_TEXT_COUNT, language,
            img_count=_INDEX_REVIEWS_IMAGE_COUNT, txt_count=_INDEX_REVIEWS_TEXT_COUNT,
            ai_ui=ai_ui,
        )
        data.setdefault("sections", {})[new_id] = new_sec
        _insert_before_reviews_two(data, new_id)

    write_theme_json(ed / "templates/index.json", data, comment, is_compact)
    pf["templates/index.json"] = (data, comment, is_compact)
    return True


def _inject_testimonials(ed: Path, pf: dict, rv: dict, language: str = "fr", ai_ui: dict = {}) -> set[str]:
    """Inject review blocks into all review sections across templates.

    - reviews-two (Avis Trustpilot) in index.json: testimonial blocks
    - reviews (Avis) in index.json: 10 image + 20 text blocks, above reviews-two
    - reviews (Avis) in product.json: 20 image + 80 text blocks

    Called BEFORE text surgery so files have the correct block count.
    Updates pf cache so subsequent surgery reads correct old values.

    Returns the set of rel-paths that were modified.
    """
    reviews = rv.get("reviews", [])
    target_count = min(len(reviews), 80)
    if not reviews:
        return set()

    modified: set[str] = set()

    # A — Avis Trustpilot: reviews-two / testimonial blocks in index.json
    if _inject_into_template(
        ed, pf, "templates/index.json",
        "reviews-two", "testimonial",
        reviews, target_count, language, ai_ui=ai_ui,
    ):
        modified.add("templates/index.json")

    # B — Avis: reviews / 10 image + 20 text blocks in index.json (above reviews-two)
    if _inject_index_reviews(ed, pf, reviews, language, ai_ui=ai_ui):
        modified.add("templates/index.json")

    # C — Avis: reviews / 20 image + 80 text blocks in product.json
    if _inject_into_template(
        ed, pf, "templates/product.json",
        "reviews", "text",
        reviews, target_count, language, ai_ui=ai_ui,
    ):
        modified.add("templates/product.json")

    return modified


def _inject_into_template(
    ed: Path, pf: dict,
    rel: str, section_type: str, block_type: str,
    reviews: list, target_count: int, language: str,
    ai_ui: dict = {},
) -> bool:
    """Populate an existing section or create it with 15 pre-filled review blocks."""
    entry = pf.get(rel)
    if not entry:
        return False

    data, comment, is_compact = entry

    # Find first existing section of that type
    found_sec = None
    for sec in data.get("sections", {}).values():
        if sec.get("type") == section_type:
            found_sec = sec
            break

    if found_sec is not None:
        # Also update the section heading in the right language
        if found_sec.get("settings") is not None:
            if section_type == "reviews-two":
                _h = _REVIEWS_TWO_HEADING.get(language) or ai_ui.get("reviews_two_heading") or _REVIEWS_TWO_HEADING["en"]
            else:
                _h = _REVIEWS_HEADING.get(language) or ai_ui.get("reviews_heading") or _REVIEWS_HEADING["en"]
            if _h:
                found_sec["settings"]["heading"] = _h
        if section_type == "reviews":
            _fill_reviews_mixed_blocks(found_sec, reviews)
        else:
            _fill_review_blocks(found_sec, block_type, reviews, target_count)
    else:
        # Only create the section if its Liquid file exists in this theme.
        # If not (e.g. Sylys has no reviews-two.liquid), skip to avoid a broken section.
        liquid_file = ed / "sections" / f"{section_type}.liquid"
        if not liquid_file.exists():
            return False
        new_id = f"reviews_{uuid.uuid4().hex[:8]}"
        new_sec = _make_review_section(section_type, block_type, reviews, target_count, language, ai_ui=ai_ui)
        data.setdefault("sections", {})[new_id] = new_sec
        _insert_before_collapsible(data, new_id)

    write_theme_json(ed / rel, data, comment, is_compact)
    pf[rel] = (data, comment, is_compact)
    return True


def _make_review_section(
    section_type: str, block_type: str,
    reviews: list, target_count: int, language: str,
    img_count: int | None = None, txt_count: int | None = None,
    ai_ui: dict = {},
) -> dict:
    """Build a complete section dict with review blocks pre-filled.

    For 'reviews' sections: img_count image blocks + txt_count text blocks
    (defaults: 20 image + 80 text for product page; pass 10/20 for homepage).
    For other sections: target_count blocks of block_type.
    """
    _img = img_count if img_count is not None else _REVIEWS_IMAGE_COUNT
    _txt = txt_count if txt_count is not None else _REVIEWS_TEXT_COUNT

    blocks = {}
    block_order = []

    if section_type == "reviews":
        for r in reviews[:_img]:
            bid = uuid.uuid4().hex[:16]
            blk = {"type": "image", "settings": dict(_block_defaults("image"))}
            _write_review_to_block(blk, "image", r)
            blocks[bid] = blk
            block_order.append(bid)
        for r in reviews[:_txt]:
            bid = uuid.uuid4().hex[:16]
            blk = {"type": "text", "settings": dict(_block_defaults("text"))}
            _write_review_to_block(blk, "text", r)
            blocks[bid] = blk
            block_order.append(bid)
    else:
        for r in reviews[:target_count]:
            bid = uuid.uuid4().hex[:16]
            blk = {"type": block_type, "settings": dict(_block_defaults(block_type))}
            _write_review_to_block(blk, block_type, r)
            blocks[bid] = blk
            block_order.append(bid)

    if section_type == "reviews-two":
        settings = {
            "heading": _REVIEWS_TWO_HEADING.get(language) or ai_ui.get("reviews_two_heading") or _REVIEWS_TWO_HEADING["en"],
            "heading_style": "1",
            "trustpilot_info": True,
            "rating": "4.8",
            "reviews_count": "238",
            "layout_width": "full",
            "color_palette": "background-1",
            "customize_slider": True,
            "navigation": True,
            "pagination": True,
            "autoplay": True,
            "speed": 4,
            "swiper_pagination_style": "dots",
            "swiper_pagination_color": "accent",
            "swiper_navigation_style": "square",
            "swiper_navigation_color": "accent",
            "enable_animations": True,
            "animation": "fade-up",
            "padding_top": 0,
            "padding_bottom": 64,
            "padding_top_sm": 0,
            "padding_bottom_sm": 32,
        }
    else:  # reviews
        settings = {
            "heading": _REVIEWS_HEADING.get(language) or ai_ui.get("reviews_heading") or _REVIEWS_HEADING["en"],
            "heading_style": "2",
            "enable_rating": True,
            "stars_style": "stars",
            "layout": "swiper",
            "layout_width": "normal",
            "slides_on_desktop": 4,
            "slides_on_tablet": 3,
            "slides_on_mobile": 1,
            "preshot_swiper": True,
            "loop": True,
            "navigation": True,
            "pagination": True,
            "autoplay": True,
            "speed": 4,
            "visible_grid_blocks": 6,
            "color_palette": "background-1",
            "enable_animations": True,
            "animation": "fade-up",
            "padding_top": 0,
            "padding_bottom": 64,
            "padding_top_sm": 0,
            "padding_bottom_sm": 32,
        }

    return {
        "type": section_type,
        "blocks": blocks,
        "block_order": block_order,
        "settings": settings,
    }


def _insert_before_collapsible(data: dict, new_id: str):
    """Insert new_id in the order array just before collapsible-content, or append."""
    sections = data.get("sections", {})
    order = data.setdefault("order", [])
    for i, sid in enumerate(order):
        if sections.get(sid, {}).get("type") == "collapsible-content":
            order.insert(i, new_id)
            return
    order.append(new_id)


def _insert_before_reviews_two(data: dict, new_id: str):
    """Insert new_id just before the reviews-two section in the order array, or append."""
    sections = data.get("sections", {})
    order = data.setdefault("order", [])
    for i, sid in enumerate(order):
        if sections.get(sid, {}).get("type") == "reviews-two":
            order.insert(i, new_id)
            return
    order.append(new_id)


def _fill_review_blocks(sec: dict, block_type: str, reviews: list, target_count: int):
    """Ensure the section has target_count blocks of block_type, then fill with reviews."""
    existing = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {})
        and sec["blocks"][bid].get("type") == block_type
    ]

    tmpl = {k: "" for k in existing[0][1].get("settings", {})} if existing else _block_defaults(block_type)

    needed = target_count - len(existing)
    for _ in range(max(0, needed)):
        new_id = uuid.uuid4().hex[:16]
        sec.setdefault("blocks", {})[new_id] = {"type": block_type, "settings": dict(tmpl)}
        sec.setdefault("block_order", []).append(new_id)

    # Rebuild after additions
    existing = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {})
        and sec["blocks"][bid].get("type") == block_type
    ]

    for i, (_, blk) in enumerate(existing[:target_count]):
        _write_review_to_block(blk, block_type, reviews[i])


_AGE_SUFFIXES = ("ans", "years", "Jahre", "år", "años", "anni", "jaar", "lat", "лет", "года", "год")

def _strip_age_suffix(age_val) -> str:
    """Return only the numeric part of an age value, stripping any language-specific suffix."""
    s = str(age_val).strip()
    for suffix in _AGE_SUFFIXES:
        if s.lower().endswith(" " + suffix.lower()):
            s = s[: -(len(suffix) + 1)].strip()
            break
    return s


def _write_review_to_block(blk: dict, block_type: str, r: dict):
    """Write a single review's data into a block's settings."""
    s = blk.setdefault("settings", {})
    if block_type == "testimonial":
        s["title"]        = r.get("title", "")
        s["text"]         = f"<p>{r.get('text', '')}</p>"
        s["author_name"]  = r.get("name", "")
        s["author_age"]   = ""
        s["rating"]       = r.get("rating", 5)
    elif block_type in ("text", "image"):
        s["heading"]      = r.get("title", "")
        s["description"]  = r.get("text", "")
        s["name"]         = r.get("name", "")
        s["verified"]     = True
        # stars_rating is a float range (min=2, max=5, step=0.1)
        s["stars_rating"] = float(r.get("rating", 5))
        # image block has an image_picker field that cannot be set programmatically


def _block_defaults(block_type: str) -> dict:
    if block_type == "testimonial":
        return {"title": "", "text": "", "author_name": "", "author_age": "", "rating": 5}
    if block_type == "image":
        return {"image": "", "heading": "", "description": "", "name": "", "verified": True, "stars_rating": 5}
    return {"heading": "", "description": "", "name": "", "verified": True, "stars_rating": 5}


_REVIEWS_IMAGE_COUNT = 20
_REVIEWS_TEXT_COUNT = 80
_INDEX_REVIEWS_IMAGE_COUNT = 10
_INDEX_REVIEWS_TEXT_COUNT = 20


def _fill_reviews_mixed_blocks(sec: dict, reviews: list):
    """Populate 'reviews' section with 20 image blocks + 80 text blocks."""
    image_reviews = reviews[:_REVIEWS_IMAGE_COUNT]
    text_reviews = reviews[:_REVIEWS_TEXT_COUNT]

    # Get existing blocks by type
    existing_image = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "image"
    ]
    existing_text = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "text"
    ]

    # Add missing image blocks
    for _ in range(max(0, _REVIEWS_IMAGE_COUNT - len(existing_image))):
        new_id = uuid.uuid4().hex[:16]
        sec.setdefault("blocks", {})[new_id] = {"type": "image", "settings": dict(_block_defaults("image"))}
        sec.setdefault("block_order", []).append(new_id)

    # Add missing text blocks
    for _ in range(max(0, _REVIEWS_TEXT_COUNT - len(existing_text))):
        new_id = uuid.uuid4().hex[:16]
        sec.setdefault("blocks", {})[new_id] = {"type": "text", "settings": dict(_block_defaults("text"))}
        sec.setdefault("block_order", []).append(new_id)

    # Rebuild after additions
    existing_image = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "image"
    ]
    existing_text = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "text"
    ]

    for i, (_, blk) in enumerate(existing_image[:_REVIEWS_IMAGE_COUNT]):
        if i < len(image_reviews):
            _write_review_to_block(blk, "image", image_reviews[i])

    for i, (_, blk) in enumerate(existing_text[:_REVIEWS_TEXT_COUNT]):
        if i < len(text_reviews):
            _write_review_to_block(blk, "text", text_reviews[i])


def _fill_index_reviews_mixed_blocks(sec: dict, reviews: list):
    """Populate homepage 'reviews' section with 10 image blocks + 20 text blocks."""
    image_reviews = reviews[:_INDEX_REVIEWS_IMAGE_COUNT]
    text_reviews = reviews[:_INDEX_REVIEWS_TEXT_COUNT]

    existing_image = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "image"
    ]
    existing_text = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "text"
    ]

    for _ in range(max(0, _INDEX_REVIEWS_IMAGE_COUNT - len(existing_image))):
        new_id = uuid.uuid4().hex[:16]
        sec.setdefault("blocks", {})[new_id] = {"type": "image", "settings": dict(_block_defaults("image"))}
        sec.setdefault("block_order", []).append(new_id)

    for _ in range(max(0, _INDEX_REVIEWS_TEXT_COUNT - len(existing_text))):
        new_id = uuid.uuid4().hex[:16]
        sec.setdefault("blocks", {})[new_id] = {"type": "text", "settings": dict(_block_defaults("text"))}
        sec.setdefault("block_order", []).append(new_id)

    existing_image = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "image"
    ]
    existing_text = [
        (bid, sec["blocks"][bid])
        for bid in sec.get("block_order", [])
        if bid in sec.get("blocks", {}) and sec["blocks"][bid].get("type") == "text"
    ]

    for i, (_, blk) in enumerate(existing_image[:_INDEX_REVIEWS_IMAGE_COUNT]):
        if i < len(image_reviews):
            _write_review_to_block(blk, "image", image_reviews[i])

    for i, (_, blk) in enumerate(existing_text[:_INDEX_REVIEWS_TEXT_COUNT]):
        if i < len(text_reviews):
            _write_review_to_block(blk, "text", text_reviews[i])


# ── Homepage ──────────────────────────────────────────────────────────────────

def _apply_homepage(ed: Path, pf: dict, hp: dict, language: str = "fr", store_name: str = "") -> bool:
    rel = "templates/index.json"
    data = _data(pf, rel)
    if not data:
        return False

    reps: list[tuple[str, str, str]] = []

    _cta_map = {
        "fr": "Découvrez", "en": "Discover", "de": "Entdecken",
        "da": "Opdag", "sv": "Upptäck", "no": "Oppdag", "fi": "Tutustu",
        "es": "Descubra", "pt": "Descubra", "it": "Scopra",
        "nl": "Ontdek", "pl": "Odkryj", "ru": "Откройте",
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
        "da": f"Velkommen til {store_name}!",
        "sv": f"Välkommen till {store_name}!",
        "no": f"Velkommen til {store_name}!",
        "fi": f"Tervetuloa {store_name}!",
        "es": f"Bienvenido a {store_name}!",
        "pt": f"Bem-vindo à {store_name}!",
        "it": f"Benvenuto su {store_name}!",
        "nl": f"Welkom bij {store_name}!",
        "pl": f"Witamy w {store_name}!",
        "ru": f"Добро пожаловать в {store_name}!",
    }
    _welcome_title_fallback = _welcome_titles.get(_lang2, _welcome_titles["en"])
    _ai_welcome_title = hp.get("welcome", {}).get("title", "")
    _welcome_title = _inline(_ai_welcome_title) if _ai_welcome_title else _inline(_welcome_title_fallback)
    rich = _sections_by_type(data, "rich-text")
    if rich:
        _, sec = rich[0]
        for _, blk in _blocks_by_type(sec, "heading"):
            _rep(reps, "heading", _s(blk, "heading"), _welcome_title)
            break
        for _, blk in _blocks_by_type(sec, "text"):
            _rep(reps, "description", _s(blk, "description"),
                 _sanitize_richtext(hp.get("welcome", {}).get("text", "")))
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
                 _sanitize_richtext(advantages[i].get("text", "")))
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
                 _sanitize_richtext(advantages[2].get("text", "")))
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
    """Apply advantages[4] into image-before-after section via text surgery.

    Uses text surgery (not JSON write) to preserve the file format bit-for-bit.
    Updates pf cache after surgery so subsequent text surgery sees updated values.
    """
    rel = "templates/product.json"
    entry = pf.get(rel)
    if not entry:
        return False

    data, _, _ = entry
    advantages = hp.get("advantages", [])
    if len(advantages) <= 4:
        return False

    adv = advantages[4]  # avantage 5 — même que image-with-text #1
    title = _inline(adv.get("title", ""))
    text = _sanitize_richtext(adv.get("text", ""))

    if not title and not text:
        return False

    reps: list[tuple[str, str, str]] = []
    for _, sec in _sections_by_type(data, "image-before-after"):
        for _, blk in _blocks_by_type(sec, "heading"):
            s = blk.get("settings", {})
            old_h = str(s.get("heading", ""))
            if old_h != title and title:
                reps.append(("heading", old_h, title))
            break
        for _, blk in _blocks_by_type(sec, "text"):
            s = blk.get("settings", {})
            old_d = str(s.get("description", ""))
            if old_d != text and text:
                reps.append(("description", old_d, text))
            break
        break  # Only first image-before-after section

    if not reps:
        return False

    file_path = ed / rel
    n = apply_replacements(file_path, reps)

    if n:
        # Refresh in-memory cache so subsequent text surgery sees new values
        from app.utils.json_handler import read_theme_json, detect_json_format
        try:
            new_data, new_comment = read_theme_json(file_path)
            new_compact = detect_json_format(file_path)
            pf[rel] = (new_data, new_comment, new_compact)
        except Exception:
            pass

    return n > 0


# ── Product page: JSON write for accordion headings (encoding-safe) ───────────

def _fix_product_accordion_headings(ed: Path, pf: dict, language: str = "fr", target_gender: str = "femme", ai_ui: dict = {}) -> bool:
    """Set fixed accordion headings in description-faq block via text surgery.

    Uses text surgery (not JSON write) to preserve the file format bit-for-bit.
    Handles empty→non-empty replacements since text_surgery now allows them.
    Must run BEFORE _apply_product_page so subsequent surgery sees updated values.
    """
    rel = "templates/product.json"
    entry = pf.get(rel)
    if not entry:
        return False

    data, comment, is_compact = entry

    _lang2 = language[:2].lower()
    _gender_plural = {
        "homme": {"fr": "hommes", "en": "men", "de": "Männer", "da": "mænd", "sv": "män", "no": "menn", "fi": "miehiä", "es": "hombres", "pt": "homens", "it": "uomini", "nl": "mannen", "pl": "mężczyzn", "ru": "мужчин"},
        "mixte": {"fr": "personnes", "en": "people", "de": "Personen", "da": "personer", "sv": "personer", "no": "personer", "fi": "henkilöä", "es": "personas", "pt": "pessoas", "it": "persone", "nl": "mensen", "pl": "osób", "ru": "человек"},
    }.get(target_gender.lower(), {"fr": "femmes", "en": "women", "de": "Frauen", "da": "kvinder", "sv": "kvinnor", "no": "kvinner", "fi": "naista", "es": "mujeres", "pt": "mulheres", "it": "donne", "nl": "vrouwen", "pl": "kobiet", "ru": "женщин"})
    _plural = _gender_plural.get(_lang2, _gender_plural["en"])
    _fixed = {
        "fr": ("Description", "Comment ça marche ?", f"+9860 {_plural} l'ont déjà adopté !"),
        "en": ("Description", "How does it work?", f"+9860 {_plural} have already adopted it!"),
        "de": ("Beschreibung", "Wie funktioniert es?", f"+9860 {_plural} haben es bereits übernommen!"),
        "es": ("Descripción", "¿Cómo funciona?", f"+9860 {_plural} ya lo han adoptado!"),
        "pt": ("Descrição", "Como funciona?", f"+9860 {_plural} já adotaram!"),
        "it": ("Descrizione", "Come funziona?", f"+9860 {_plural} lo hanno già adottato!"),
        "nl": ("Beschrijving", "Hoe werkt het?", f"+9860 {_plural} hebben het al overgenomen!"),
        "da": ("Beskrivelse", "Hvordan virker det?", f"+9860 {_plural} har allerede taget det til sig!"),
        "sv": ("Beskrivning", "Hur fungerar det?", f"+9860 {_plural} har redan antagit det!"),
        "no": ("Beskrivelse", "Hvordan fungerer det?", f"+9860 {_plural} har allerede tatt det i bruk!"),
        "fi": ("Kuvaus", "Miten se toimii?", f"+9860 {_plural} on jo ottanut sen käyttöön!"),
        "pl": ("Opis", "Jak to działa?", f"+9860 {_plural} już to przyjęło!"),
        "ru": ("Описание", "Как это работает?", f"+9860 {_plural} уже попробовали!"),
    }
    _fixed_tuple = _fixed.get(_lang2)
    if _fixed_tuple:
        h1, h2, h3 = _fixed_tuple
    else:
        h1 = ai_ui.get("accordion_description") or _fixed["en"][0]
        h2 = ai_ui.get("accordion_how_it_works") or _fixed["en"][1]
        h3 = _fixed["en"][2]  # dynamic plural form, no ai_ui key for it

    main = _section_by_type(data, "main-product")
    if not main:
        return False
    _, msec = main

    reps: list[tuple[str, str, str]] = []
    # Try all description block type names used across Story theme variants
    _desc_blocks = (
        _blocks_by_type(msec, "description-faq")
        or _blocks_by_type(msec, "description-text")
        or _blocks_by_type(msec, "description")
    )
    for _, blk in _desc_blocks:
        s = blk.get("settings", {})
        for key, val in [("heading1", h1), ("heading2", h2), ("heading3", h3)]:
            old = str(s.get(key, ""))
            if old != val:
                reps.append((key, old, val))
        break

    if not reps:
        return False

    file_path = ed / rel
    n = apply_replacements(file_path, reps)

    if n:
        # Refresh in-memory cache so subsequent text surgery sees new values
        from app.utils.json_handler import read_theme_json, detect_json_format
        try:
            new_data, new_comment = read_theme_json(file_path)
            new_compact = detect_json_format(file_path)
            pf[rel] = (new_data, new_comment, new_compact)
        except Exception:
            pass

    return n > 0


# ── Product page ──────────────────────────────────────────────────────────────

def _apply_product_page(ed: Path, pf: dict, pp: dict, hp: dict, language: str = "fr", target_gender: str = "femme", delivery_delay: str = "", return_policy_days: str = "30", ai_ui: dict = {}) -> bool:
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
        "homme": {"fr": "hommes", "en": "men", "de": "Männer", "da": "mænd", "sv": "män", "no": "menn", "fi": "miehiä", "es": "hombres", "pt": "homens", "it": "uomini", "nl": "mannen", "pl": "mężczyzn", "ru": "мужчин"},
        "mixte": {"fr": "personnes", "en": "people", "de": "Personen", "da": "personer", "sv": "personer", "no": "personer", "fi": "henkilöä", "es": "personas", "pt": "pessoas", "it": "persone", "nl": "mensen", "pl": "osób", "ru": "человек"},
    }.get(target_gender.lower(), {"fr": "femmes", "en": "women", "de": "Frauen", "da": "kvinder", "sv": "kvinnor", "no": "kvinner", "fi": "naista", "es": "mujeres", "pt": "mulheres", "it": "donne", "nl": "vrouwen", "pl": "kobiet", "ru": "женщин"})
    _plural = _gender_plural.get(_lang, _gender_plural["en"])
    _fixed_headings = {
        "fr": ("Description", "Comment ça marche ?", f"+9860 {_plural} l'ont déjà adopté !"),
        "en": ("Description", "How does it work?", f"+9860 {_plural} have already adopted it!"),
        "de": ("Beschreibung", "Wie funktioniert es?", f"+9860 {_plural} haben es bereits übernommen!"),
        "da": ("Beskrivelse", "Hvordan virker det?", f"+9860 {_plural} har allerede brugt det!"),
        "sv": ("Beskrivning", "Hur fungerar det?", f"+9860 {_plural} har redan använt det!"),
        "no": ("Beskrivelse", "Hvordan fungerer det?", f"+9860 {_plural} har allerede brukt det!"),
        "fi": ("Kuvaus", "Miten se toimii?", f"+9860 {_plural} on jo käyttänyt sitä!"),
        "es": ("Descripción", "¿Cómo funciona?", f"+9860 {_plural} ya lo han adoptado!"),
        "pt": ("Descrição", "Como funciona?", f"+9860 {_plural} já adotaram!"),
        "it": ("Descrizione", "Come funziona?", f"+9860 {_plural} lo hanno già adottato!"),
        "nl": ("Beschrijving", "Hoe werkt het?", f"+9860 {_plural} hebben het al overgenomen!"),
        "pl": ("Opis", "Jak to działa?", f"+9860 {_plural} już to wypróbowało!"),
        "ru": ("Описание", "Как это работает?", f"+9860 {_plural} уже попробовали!"),
    }
    _fh_tuple = _fixed_headings.get(_lang)
    if _fh_tuple:
        h1, h2, h3 = _fh_tuple
    else:
        h1 = ai_ui.get("accordion_description") or _fixed_headings["en"][0]
        h2 = ai_ui.get("accordion_how_it_works") or _fixed_headings["en"][1]
        h3 = _fixed_headings["en"][2]  # dynamic plural form, no ai_ui key for it

    # C/D/E — Bloc description-faq (also description-text in Basic, description in Sylys)
    _desc_blks = (
        _blocks_by_type(msec, "description-faq")
        or _blocks_by_type(msec, "description-text")
        or _blocks_by_type(msec, "description")
    )
    for _, blk in _desc_blks:
        s = blk.get("settings", {})
        # heading1 = "Description" (fixe)
        _rep(reps, "heading1", str(s.get("heading1", "")), h1)
        if pp.get("product_description"):
            _rep(reps, "text1", str(s.get("text1", "")),
                 _sanitize_richtext(pp["product_description"].get("text", "")))
        # heading2 = "Comment ça marche ?" (fixe)
        _rep(reps, "heading2", str(s.get("heading2", "")), h2)
        if pp.get("how_it_works"):
            _rep(reps, "text2", str(s.get("text2", "")),
                 _sanitize_richtext(pp["how_it_works"].get("text", "")))
        # heading3: "Nos ingrédients" for natural products, social proof otherwise
        _adoption_heading = pp.get("adoption", {}).get("heading", "")
        _is_ingredients = any(
            kw in _adoption_heading.lower()
            for kw in ["ingr", "zutat", "ingredi"]
        )
        _h3_effective = _adoption_heading if _is_ingredients else h3
        _rep(reps, "heading3", str(s.get("heading3", "")), _h3_effective)
        if pp.get("adoption"):
            _rep(reps, "text3", str(s.get("text3", "")),
                 _sanitize_richtext(pp["adoption"].get("text", "")))
        # D4 — Delivery accordion (heading4 / text4) — hardcoded multilingual
        _delivery_h4 = {
            "fr": "Informations sur la livraison",
            "en": "Delivery information",
            "de": "Lieferinformationen",
            "da": "Leveringsoplysninger",
            "sv": "Leveransinformation",
            "no": "Leveringsinformasjon",
            "fi": "Toimitusehdot",
            "es": "Información de envío",
            "pt": "Informações de entrega",
            "it": "Informazioni sulla spedizione",
            "nl": "Leveringsinformatie",
            "pl": "Informacje o dostawie",
            "ru": "Информация о доставке",
        }
        _delivery_t4_tpl = {
            "fr": "<p>Nos délais de livraison sont de <strong>{d}</strong>. Livraison suivie incluse.</p><p>Satisfait ou remboursé sous <strong>{r} jours</strong>.</p>",
            "en": "<p>Our delivery times are <strong>{d}</strong>. Tracked shipping included.</p><p>Satisfied or refunded within <strong>{r} days</strong>.</p>",
            "de": "<p>Unsere Lieferzeiten betragen <strong>{d}</strong>. Sendungsverfolgung inklusive.</p><p>Zufrieden oder Geld zurück innerhalb von <strong>{r} Tagen</strong>.</p>",
            "da": "<p>Vores leveringstider er <strong>{d}</strong>. Sporbar levering inkluderet.</p><p>Tilfreds eller pengene tilbage inden for <strong>{r} dage</strong>.</p>",
            "sv": "<p>Våra leveranstider är <strong>{d}</strong>. Spårbar leverans ingår.</p><p>Nöjd eller pengarna tillbaka inom <strong>{r} dagar</strong>.</p>",
            "no": "<p>Våre leveringstider er <strong>{d}</strong>. Sporet levering inkludert.</p><p>Fornøyd eller pengene tilbake innen <strong>{r} dager</strong>.</p>",
            "fi": "<p>Toimitusaikamme on <strong>{d}</strong>. Seurattava toimitus sisältyy.</p><p>Tyytyväinen tai rahat takaisin <strong>{r} päivän</strong> kuluessa.</p>",
            "es": "<p>Nuestros plazos de entrega son de <strong>{d}</strong>. Envío con seguimiento incluido.</p><p>Satisfecho o reembolsado en <strong>{r} días</strong>.</p>",
            "pt": "<p>Nossos prazos de entrega são de <strong>{d}</strong>. Envio rastreado incluído.</p><p>Satisfeito ou reembolsado em <strong>{r} dias</strong>.</p>",
            "it": "<p>I nostri tempi di consegna sono di <strong>{d}</strong>. Spedizione tracciata inclusa.</p><p>Soddisfatto o rimborsato entro <strong>{r} giorni</strong>.</p>",
            "nl": "<p>Onze levertijden zijn <strong>{d}</strong>. Getraceerde verzending inbegrepen.</p><p>Tevreden of terugbetaald binnen <strong>{r} dagen</strong>.</p>",
            "pl": "<p>Nasze czasy dostawy wynoszą <strong>{d}</strong>. Przesyłka śledzona w zestawie.</p><p>Zadowolony lub zwrot pieniędzy w ciągu <strong>{r} dni</strong>.</p>",
            "ru": "<p>Сроки доставки составляют <strong>{d}</strong>. Включено отслеживание.</p><p>Удовлетворены или вернём деньги в течение <strong>{r} дней</strong>.</p>",
        }
        _h4 = _delivery_h4.get(_lang) or ai_ui.get("delivery_heading") or _delivery_h4["en"]
        if ai_ui.get("delivery_body"):
            # AI-translated delivery body for non-13 languages: replace $delay/$return placeholders
            _body = (
                ai_ui["delivery_body"]
                .replace("$delay", delivery_delay or "3-5 days")
                .replace("$return", return_policy_days or "30")
            )
            _t4_raw = f"<p>{_body}</p>"
        else:
            _t4_raw = _delivery_t4_tpl.get(_lang, _delivery_t4_tpl["en"]).format(
                d=delivery_delay or "3-5 jours", r=return_policy_days or "30"
            )
        _rep(reps, "heading4", str(s.get("heading4", "")), _h4)
        _rep(reps, "text4", str(s.get("text4", "")), _sanitize_richtext(_t4_raw))
        break

    # D5 — Delivery estimation block labels (hardcoded multilingual)
    _today_l = {
        "fr": "Commande", "en": "Order", "de": "Bestellung", "da": "Bestilling",
        "sv": "Beställning", "no": "Bestilling", "fi": "Tilaus", "es": "Pedido",
        "pt": "Pedido", "it": "Ordine", "nl": "Bestelling", "pl": "Zamówienie", "ru": "Заказ",
    }
    _ready_l = {
        "fr": "Commande Prête", "en": "Order Ready", "de": "Bestellung Bereit",
        "da": "Ordre Klar", "sv": "Order Klar", "no": "Ordre Klar", "fi": "Tilaus Valmis",
        "es": "Pedido Listo", "pt": "Pedido Pronto", "it": "Ordine Pronto",
        "nl": "Bestelling Klaar", "pl": "Zamówienie Gotowe", "ru": "Заказ Готов",
    }
    _delivered_l = {
        "fr": "Livraison", "en": "Delivery", "de": "Lieferung", "da": "Levering",
        "sv": "Leverans", "no": "Levering", "fi": "Toimitus", "es": "Entrega",
        "pt": "Entrega", "it": "Consegna", "nl": "Levering", "pl": "Dostawa", "ru": "Доставка",
    }
    for _, blk in _blocks_by_type(msec, "delivery_estimation"):
        _rep(reps, "today_info", _s(blk, "today_info"), _today_l.get(_lang) or ai_ui.get("delivery_today") or _today_l["en"])
        _rep(reps, "ready_info", _s(blk, "ready_info"), _ready_l.get(_lang) or ai_ui.get("delivery_ready") or _ready_l["en"])
        _rep(reps, "delivered_info", _s(blk, "delivered_info"), _delivered_l.get(_lang) or ai_ui.get("delivery_delivered") or _delivered_l["en"])
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
                 _sanitize_richtext(adv.get("text", "")))
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

    # J — Static section headings: marquee-logo, ugc (hardcoded multilingual)
    _marquee_h = {
        "fr": "Ils parlent de nous :", "en": "They talk about us:",
        "de": "Sie sprechen über uns:", "da": "De taler om os:", "sv": "De pratar om oss:",
        "no": "De snakker om oss:", "fi": "He puhuvat meistä:", "es": "Hablan de nosotros:",
        "pt": "Eles falam de nós:", "it": "Parlano di noi:", "nl": "Ze praten over ons:",
        "pl": "Mówią o nas:", "ru": "Они говорят о нас:",
    }
    _ugc_h = {
        "fr": "Ils ont utilisé notre produit et sont satisfaits",
        "en": "They used our product and are satisfied",
        "de": "Sie haben unser Produkt verwendet und sind zufrieden",
        "da": "De har brugt vores produkt og er tilfredse",
        "sv": "De har använt vår produkt och är nöjda",
        "no": "De har brukt produktet vårt og er fornøyde",
        "fi": "He ovat käyttäneet tuotettamme ja ovat tyytyväisiä",
        "es": "Han usado nuestro producto y están satisfechos",
        "pt": "Eles usaram nosso produto e estão satisfeitos",
        "it": "Hanno usato il nostro prodotto e sono soddisfatti",
        "nl": "Ze hebben ons product gebruikt en zijn tevreden",
        "pl": "Używali naszego produktu i są zadowoleni",
        "ru": "Они использовали наш продукт и довольны",
    }
    for _, sec in _sections_by_type(data, "marquee-logo"):
        _rep(reps, "heading", str(sec.get("settings", {}).get("heading", "")),
             _marquee_h.get(_lang) or ai_ui.get("marquee_heading") or _marquee_h["en"])
    for _, sec in _sections_by_type(data, "ugc"):
        _rep(reps, "heading", str(sec.get("settings", {}).get("heading", "")),
             _ugc_h.get(_lang) or ai_ui.get("ugc_heading") or _ugc_h["en"])

    # K — main-product: product tagline, delivery promo, buy button (hardcoded multilingual)
    _tagline = {
        "fr": "Qualité Supérieure. Livraison Gratuite",
        "en": "Superior Quality. Free Shipping",
        "de": "Überlegene Qualität. Kostenloser Versand",
        "da": "Overlegen kvalitet. Gratis forsendelse",
        "sv": "Överlägsen kvalitet. Gratis frakt",
        "no": "Overlegen kvalitet. Gratis frakt",
        "fi": "Ylivoimainen laatu. Ilmainen toimitus",
        "es": "Calidad Superior. Envío Gratuito",
        "pt": "Qualidade Superior. Frete Grátis",
        "it": "Qualità Superiore. Spedizione Gratuita",
        "nl": "Superieure Kwaliteit. Gratis Verzending",
        "pl": "Wyższa Jakość. Darmowa Dostawa",
        "ru": "Превосходное Качество. Бесплатная Доставка",
    }
    _promo = {
        "fr": "🚚 Livraison Gratuite Seulement Aujourd'hui",
        "en": "🚚 Free Shipping Today Only",
        "de": "🚚 Kostenloser Versand Nur Heute",
        "da": "🚚 Gratis Fragt Kun I Dag",
        "sv": "🚚 Gratis Frakt Endast Idag",
        "no": "🚚 Gratis Frakt Kun I Dag",
        "fi": "🚚 Ilmainen Toimitus Vain Tänään",
        "es": "🚚 Envío Gratuito Solo Hoy",
        "pt": "🚚 Frete Grátis Somente Hoje",
        "it": "🚚 Spedizione Gratuita Solo Oggi",
        "nl": "🚚 Gratis Verzending Alleen Vandaag",
        "pl": "🚚 Darmowa Dostawa Tylko Dziś",
        "ru": "🚚 Бесплатная Доставка Только Сегодня",
    }
    _btn_text = {
        "fr": "AJOUTER AU PANIER", "en": "ADD TO CART", "de": "IN DEN WARENKORB",
        "da": "TILFØJ TIL KURV", "sv": "LÄGG I VARUKORG", "no": "LEGG I HANDLEKURV",
        "fi": "LISÄÄ OSTOSKORIIN", "es": "AÑADIR AL CARRITO", "pt": "ADICIONAR AO CARRINHO",
        "it": "AGGIUNGI AL CARRELLO", "nl": "IN WINKELWAGEN", "pl": "DODAJ DO KOSZYKA",
        "ru": "ДОБАВИТЬ В КОРЗИНУ",
    }
    for i, (_, blk) in enumerate(_blocks_by_type(msec, "text")):
        old_text = _s(blk, "text")
        if i == 0:
            _rep(reps, "text", old_text, _tagline.get(_lang) or ai_ui.get("product_tagline") or _tagline["en"])
        elif i == 1:
            _rep(reps, "text", old_text, _promo.get(_lang) or ai_ui.get("delivery_promo") or _promo["en"])
    for _, blk in _blocks_by_type(msec, "buy_buttons"):
        _rep(reps, "button_text", _s(blk, "button_text"), _btn_text.get(_lang) or ai_ui.get("buy_button") or _btn_text["en"])
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

def _apply_tracking_page(ed: Path, pf: dict, language: str = "fr", ai_ui: dict = {}) -> bool:
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
        "da": ("Spor min ordre", "Indtast dit ordrenummer for at finde ud af den aktuelle placering.", "Spor", "Ordresporingsnummer"),
        "sv": ("Spåra min beställning", "Ange ditt ordernummer för att se aktuell plats.", "Spåra", "Orderspårningsnummer"),
        "no": ("Spor min bestilling", "Oppgi bestillingsnummeret ditt for å se aktuell plassering.", "Spor", "Sporingsnummer for bestilling"),
        "fi": ("Seuraa tilaustani", "Syötä tilausnumerosi nähdäksesi sen nykyinen sijainti.", "Seuraa", "Tilauksen seurantanumero"),
        "es": ("Seguir mi pedido", "Introduce el número de tu pedido para conocer su ubicación actual.", "Seguir", "Número de seguimiento del pedido"),
        "pt": ("Rastrear meu pedido", "Insira o número do seu pedido para saber a sua localização atual.", "Rastrear", "Número de rastreamento do pedido"),
        "it": ("Traccia il mio ordine", "Inserisci il numero del tuo ordine per conoscere la sua posizione attuale.", "Traccia", "Numero di tracciamento dell'ordine"),
        "nl": ("Volg mijn bestelling", "Voer uw bestelnummer in om de huidige locatie te weten.", "Volgen", "Bestelling trackingnummer"),
        "pl": ("Śledź moje zamówienie", "Wpisz numer zamówienia, aby poznać jego aktualną lokalizację.", "Śledź", "Numer śledzenia zamówienia"),
        "ru": ("Отследить заказ", "Введите номер заказа, чтобы узнать его текущее местонахождение.", "Отследить", "Номер отслеживания заказа"),
    }
    _tp = _texts.get(_lang2)
    if _tp:
        heading, description, button, track = _tp
    else:
        heading = ai_ui.get("tracking_heading") or _texts["en"][0]
        description = ai_ui.get("tracking_description") or _texts["en"][1]
        button = ai_ui.get("tracking_button") or _texts["en"][2]
        track = ai_ui.get("tracking_label") or _texts["en"][3]

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

def _apply_contact_page(ed: Path, pf: dict, language: str = "fr", ai_ui: dict = {}) -> bool:
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
        "da": ("Ordrenummer", "Send"),
        "sv": ("Ordernummer", "Skicka"),
        "no": ("Bestillingsnummer", "Send"),
        "fi": ("Tilausnumero", "Lähetä"),
        "es": ("Número de Pedido", "Enviar"),
        "pt": ("Número do Pedido", "Enviar"),
        "it": ("Numero Ordine", "Invia"),
        "nl": ("Bestelnummer", "Versturen"),
        "pl": ("Numer Zamówienia", "Wyślij"),
        "ru": ("Номер Заказа", "Отправить"),
    }
    _cp = _texts.get(_lang2)
    if _cp:
        order_number, button_text = _cp
    else:
        order_number = ai_ui.get("contact_order_number") or _texts["en"][0]
        button_text = ai_ui.get("contact_send") or _texts["en"][1]

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

def _apply_header(ed: Path, pf: dict, gt: dict, language: str = "fr", ai_ui: dict = {}) -> bool:
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
        "da": "VORES TILBUD: KØB 1, FÅ DEN 2. TIL -50% I",
        "sv": "VÅRT ERBJUDANDE: KÖP 1, FÅ DEN 2:A TILL -50% I",
        "no": "VÅRT TILBUD: KJØP 1, FÅ DEN 2. TIL -50% I",
        "fi": "TARJOUKSEMME: OSTA 1, SAA TOINEN -50% HINTAAN",
        "es": "NUESTRA OFERTA: COMPRA 1, EL 2º AL -50% DURANTE",
        "pt": "NOSSA OFERTA: COMPRE 1, O 2º A -50% POR",
        "it": "LA NOSTRA OFFERTA: ACQUISTA 1, IL 2° A -50% PER",
        "nl": "ONS AANBOD: KOOP 1, DE 2E VOOR -50% GEDURENDE",
        "pl": "NASZA OFERTA: KUP 1, DRUGI ZA -50% PRZEZ",
        "ru": "НАШЕ ПРЕДЛОЖЕНИЕ: КУПИ 1, ПОЛУЧИ 2-Й ЗА -50% В ТЕЧЕНИЕ",
    }
    _timer_text = _timer_texts.get(_lang2) or ai_ui.get("header_timer") or _timer_texts["en"]

    for _, sec in data.get("sections", {}).items():
        if sec.get("type") != "announcement-bar":
            continue
        for _, blk in sec.get("blocks", {}).items():
            btype = blk.get("type", "")
            # announcement-fade and plain announcement are used by some themes instead of announcement-timer
            if btype in ("announcement-timer", "announcement-fade", "announcement"):
                _rep(reps, "text", _s(blk, "text"), _inline(_timer_text))
            elif btype == "announcement-marquee":
                _marquee_texts = {
                    "fr": "PLUS DE 9860 PERSONNES NOUS RECOMMANDENT",
                    "en": "MORE THAN 9860 PEOPLE RECOMMEND US",
                    "de": "MEHR ALS 9860 PERSONEN EMPFEHLEN UNS",
                    "da": "MERE END 9860 MENNESKER ANBEFALER OS",
                    "sv": "MER ÄN 9860 MÄNNISKOR REKOMMENDERAR OSS",
                    "no": "MER ENN 9860 PERSONER ANBEFALER OSS",
                    "fi": "YLI 9860 IHMISTÄ SUOSITTELEE MEITÄ",
                    "es": "MÁS DE 9860 PERSONAS NOS RECOMIENDAN",
                    "pt": "MAIS DE 9860 PESSOAS NOS RECOMENDAM",
                    "it": "PIÙ DI 9860 PERSONE CI RACCOMANDANO",
                    "nl": "MEER DAN 9860 MENSEN BEVELEN ONS AAN",
                    "pl": "PONAD 9860 OSÓB NAS POLECA",
                    "ru": "БОЛЕЕ 9860 ЧЕЛОВЕК РЕКОМЕНДУЮТ НАС",
                }
                _rep(reps, "text", _s(blk, "text"),
                     _inline(_marquee_texts.get(_lang2) or ai_ui.get("header_marquee") or _marquee_texts["en"]))

    return apply_replacements(ed / rel, reps) > 0


# ── Footer ────────────────────────────────────────────────────────────────────

def _apply_footer(ed: Path, pf: dict, gt: dict, language: str = "fr", store_name: str = "", ai_ui: dict = {}) -> bool:
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
        "da": f"BLIV EN DEL AF {_store_upper} TEAMET!",
        "sv": f"GÅ MED I {_store_upper} TEAMET!",
        "no": f"BLI MED I {_store_upper} TEAMET!",
        "fi": f"LIITY {_store_upper} TIIMIIN!",
        "es": f"¡ÚNETE AL EQUIPO {_store_upper}!",
        "pt": f"JUNTE-SE À EQUIPE {_store_upper}!",
        "it": f"UNISCITI AL TEAM {_store_upper}!",
        "nl": f"WORD LID VAN HET TEAM {_store_upper}!",
        "pl": f"DOŁĄCZ DO ZESPOŁU {_store_upper}!",
        "ru": f"ПРИСОЕДИНЯЙТЕСЬ К КОМАНДЕ {_store_upper}!",
    }
    reps: list[tuple[str, str, str]] = []
    footer = gt.get("footer", {})

    # Use AI-generated newsletter heading for non-13 languages (it includes the store name),
    # otherwise use the hardcoded multilingual dict.
    _newsletter_heading = (
        footer.get("newsletter_heading")
        or _newsletter_headings.get(_lang2)
        or _newsletter_headings["en"]
    )

    for _, sec in data.get("sections", {}).items():
        stype = sec.get("type", "")

        if stype == "icons":
            # Trust badges — icons.description is inline_richtext
            badges = footer.get("trust_badges", [])
            store_strong = f"<strong>{store_name}</strong>" if store_name else None

            for i, (_, blk) in enumerate(_blocks_by_type(sec, "icon")):
                current_desc = _s(blk, "description")
                b = badges[i] if i < len(badges) else {}

                # Heading: use AI value only if it contains visible text
                if b.get("heading"):
                    heading_clean = re.sub(r"<[^>]+>", "", b["heading"]).strip()
                    if heading_clean:
                        _rep(reps, "heading", _s(blk, "heading"), b["heading"])

                # Description: prefer AI value if it contains visible text, else keep original
                final_desc = None
                if b.get("description"):
                    candidate = _inline(b["description"])
                    if re.sub(r"<[^>]+>", "", candidate).strip():
                        final_desc = candidate

                if final_desc is None:
                    # French or empty AI — keep the original from the theme file
                    final_desc = current_desc

                # Substitute store name only in <strong> tags introduced by a brand preposition
                # (e.g. "Chez <strong>OldName</strong>" → "Chez <strong>NewName</strong>")
                # Leaves emphasis tags like "<strong>livraison gratuite</strong>" untouched.
                if store_strong and final_desc:
                    final_desc = re.sub(
                        r"((?:Chez|At|By|Bei|Con|Met|Da|Com|Na|Avec|With)\s+)<strong>[^<]*</strong>",
                        rf"\1{store_strong}",
                        final_desc,
                        flags=re.IGNORECASE,
                    )

                if final_desc and final_desc != current_desc:
                    _rep(reps, "description", current_desc, final_desc)

        elif stype == "footer":
            link_idx = 0
            for _, blk in _blocks_in_order(sec):
                btype = blk.get("type", "")

                if btype == "image":
                    # brand_text (À propos) — text_footer is richtext
                    if footer.get("brand_text"):
                        _rep(reps, "text_footer", _s(blk, "text_footer"),
                             _sanitize_richtext(footer["brand_text"]))

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

def _apply_settings_data(ed: Path, pf: dict, gt: dict, language: str = "fr", ai_ui: dict = {}) -> bool:
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
        "da": "Nyd 10% ekstra rabat i $time",
        "sv": "Njut av 10% extra rabatt i $time",
        "no": "Nyt 10% ekstra rabatt i $time",
        "fi": "Nauti 10% lisäalennuksesta $time ajan",
        "es": "Disfruta de un 10% de descuento adicional durante $time",
        "pt": "Aproveite 10% de desconto adicional por $time",
        "it": "Approfitta di uno sconto extra del 10% per $time",
        "nl": "Geniet van 10% extra korting gedurende $time",
        "pl": "Skorzystaj z dodatkowego rabatu 10% przez $time",
        "ru": "Получите дополнительную скидку 10% в течение $time",
    }
    _delivery_labels = {
        "fr": ("Commande", "Commande Prête", "Livraison"),
        "en": ("Order", "Order Ready", "Delivery"),
        "de": ("Bestellung", "Bestellung Bereit", "Lieferung"),
        "da": ("Ordre", "Ordre Klar", "Levering"),
        "sv": ("Beställning", "Beställning Klar", "Leverans"),
        "no": ("Ordre", "Ordre Klar", "Levering"),
        "fi": ("Tilaus", "Tilaus Valmis", "Toimitus"),
        "es": ("Pedido", "Pedido Listo", "Entrega"),
        "pt": ("Pedido", "Pedido Pronto", "Entrega"),
        "it": ("Ordine", "Ordine Pronto", "Consegna"),
        "nl": ("Bestelling", "Bestelling Klaar", "Levering"),
        "pl": ("Zamówienie", "Zamówienie Gotowe", "Dostawa"),
        "ru": ("Заказ", "Заказ Готов", "Доставка"),
    }
    _upsell_titles = {
        "fr": "Vous allez adorer cet article",
        "en": "You'll love this item",
        "de": "Das werden Sie lieben",
        "da": "Du vil elske denne vare",
        "sv": "Du kommer att älska den här artikeln",
        "no": "Du vil elske denne varen",
        "fi": "Tulet rakastamaan tätä tuotetta",
        "es": "Te encantará este artículo",
        "pt": "Você vai adorar este item",
        "it": "Amerai questo articolo",
        "nl": "Je zult dit artikel geweldig vinden",
        "pl": "Pokochasz ten produkt",
        "ru": "Вам понравится этот товар",
    }
    _savings = {
        "fr": "Vous économisez",
        "en": "You save",
        "de": "Sie sparen",
        "da": "Du sparer",
        "sv": "Du sparar",
        "no": "Du sparer",
        "fi": "Säästät",
        "es": "Ahorras",
        "pt": "Você economiza",
        "it": "Risparmi",
        "nl": "U bespaart",
        "pl": "Oszczędzasz",
        "ru": "Вы экономите",
    }
    _subtotal = {
        "fr": "Sous-Total",
        "en": "Subtotal",
        "de": "Zwischensumme",
        "da": "Subtotal",
        "sv": "Delsumma",
        "no": "Delsum",
        "fi": "Välisumma",
        "es": "Subtotal",
        "pt": "Subtotal",
        "it": "Subtotale",
        "nl": "Subtotaal",
        "pl": "Suma częściowa",
        "ru": "Промежуточный итог",
    }
    _total = {
        "fr": "Total",
        "en": "Total",
        "de": "Gesamt",
        "da": "Total",
        "sv": "Totalt",
        "no": "Total",
        "fi": "Yhteensä",
        "es": "Total",
        "pt": "Total",
        "it": "Totale",
        "nl": "Totaal",
        "pl": "Łącznie",
        "ru": "Итого",
    }
    _upsell_btn = {
        "fr": "Ajoutez",
        "en": "Add",
        "de": "Hinzufügen",
        "da": "Tilføj",
        "sv": "Lägg till",
        "no": "Legg til",
        "fi": "Lisää",
        "es": "Agregue",
        "pt": "Adicione",
        "it": "Aggiunga",
        "nl": "Voeg toe",
        "pl": "Dodaj",
        "ru": "Добавьте",
    }
    _protection = {
        "fr": "Protégez votre commande contre les dommages, la perte ou le vol.",
        "en": "Protect your order against damage, loss or theft.",
        "de": "Schützen Sie Ihre Bestellung gegen Beschädigung, Verlust oder Diebstahl.",
        "da": "Beskyt din ordre mod skade, tab eller tyveri.",
        "sv": "Skydda din beställning mot skada, förlust eller stöld.",
        "no": "Beskytt bestillingen din mot skade, tap eller tyveri.",
        "fi": "Suojaa tilauksesi vahingoilta, katoamiselta tai varkaudelta.",
        "es": "Proteja su pedido contra daños, pérdida o robo.",
        "pt": "Proteja seu pedido contra danos, perda ou roubo.",
        "it": "Proteggi il tuo ordine da danni, perdita o furto.",
        "nl": "Bescherm uw bestelling tegen schade, verlies of diefstal.",
        "pl": "Chroń swoje zamówienie przed uszkodzeniem, utratą lub kradzieżą.",
        "ru": "Защитите свой заказ от повреждений, потери или кражи.",
    }
    _cart_footer = {
        "fr": "<strong>⭐4.8/5 Trustpilot | 🔐 Paiement Sécurisé</strong>",
        "en": "<strong>⭐4.8/5 Trustpilot | 🔐 Secure Payment</strong>",
        "de": "<strong>⭐4.8/5 Trustpilot | 🔐 Sichere Zahlung</strong>",
        "da": "<strong>⭐4.8/5 Trustpilot | 🔐 Sikker Betaling</strong>",
        "sv": "<strong>⭐4.8/5 Trustpilot | 🔐 Säker Betalning</strong>",
        "no": "<strong>⭐4.8/5 Trustpilot | 🔐 Sikker Betaling</strong>",
        "fi": "<strong>⭐4.8/5 Trustpilot | 🔐 Turvallinen Maksu</strong>",
        "es": "<strong>⭐4.8/5 Trustpilot | 🔐 Pago Seguro</strong>",
        "pt": "<strong>⭐4.8/5 Trustpilot | 🔐 Pagamento Seguro</strong>",
        "it": "<strong>⭐4.8/5 Trustpilot | 🔐 Pagamento Sicuro</strong>",
        "nl": "<strong>⭐4.8/5 Trustpilot | 🔐 Veilige Betaling</strong>",
        "pl": "<strong>⭐4.8/5 Trustpilot | 🔐 Bezpieczna Płatność</strong>",
        "ru": "<strong>⭐4.8/5 Trustpilot | 🔐 Безопасная Оплата</strong>",
    }
    _timeout = {
        "fr": "Offre expirée",
        "en": "Offer expired",
        "de": "Angebot abgelaufen",
        "da": "Tilbud udløbet",
        "sv": "Erbjudandet har gått ut",
        "no": "Tilbudet er utløpt",
        "fi": "Tarjous vanhentunut",
        "es": "Oferta expirada",
        "pt": "Oferta expirada",
        "it": "Offerta scaduta",
        "nl": "Aanbieding verlopen",
        "pl": "Oferta wygasła",
        "ru": "Предложение истекло",
    }
    _product_card_btn = {
        "fr": "Ajoutez au panier",
        "en": "Add to Cart",
        "de": "In den Warenkorb",
        "da": "Læg i kurv",
        "sv": "Lägg i kundvagn",
        "no": "Legg i handlekurv",
        "fi": "Lisää koriin",
        "es": "Agregue al carrito",
        "pt": "Adicione ao carrinho",
        "it": "Aggiunga al carrello",
        "nl": "In winkelwagen",
        "pl": "Dodaj do koszyka",
        "ru": "Добавьте в корзину",
    }
    _cart_button = {
        "fr": "AJOUTEZ AU PANIER",
        "en": "ADD TO CART",
        "de": "IN DEN WARENKORB",
        "da": "LÆG I KURV",
        "sv": "LÄGG I KUNDVAGNEN",
        "no": "LEGG I HANDLEKURVEN",
        "fi": "LISÄÄ OSTOSKORIIN",
        "es": "AGREGUE AL CARRITO",
        "pt": "ADICIONE AO CARRINHO",
        "it": "AGGIUNGA AL CARRELLO",
        "nl": "IN WINKELWAGEN",
        "pl": "DODAJ DO KOSZYKA",
        "ru": "ДОБАВЬТЕ В КОРЗИНУ",
    }

    timer_text = _timer_texts.get(_lang2) or ai_ui.get("timer_text") or _timer_texts["en"]
    _dl = _delivery_labels.get(_lang2)
    if _dl:
        today, ready, delivered = _dl
    else:
        today = ai_ui.get("delivery_today") or _delivery_labels["en"][0]
        ready = ai_ui.get("delivery_ready") or _delivery_labels["en"][1]
        delivered = ai_ui.get("delivery_delivered") or _delivery_labels["en"][2]

    reps: list[tuple[str, str, str]] = []
    settings_txt = gt.get("settings", {})
    cur = data.get("current", {})

    # Top-level settings — ai_ui first so non-13-lang AI translations win over
    # the English-fallback values injected by _STATIC_UI for unknown languages.
    _rep(reps, "product_card_button_text",
         str(cur.get("product_card_button_text", "")),
         ai_ui.get("product_card_button") or settings_txt.get("product_card_button_text") or _product_card_btn.get(_lang2) or _product_card_btn["en"])
    _rep(reps, "timer_timeout_text",
         str(cur.get("timer_timeout_text", "")),
         ai_ui.get("timer_timeout") or settings_txt.get("timer_timeout_text") or _timeout.get(_lang2) or _timeout["en"])

    # Cart-drawer section — always use hardcoded translations for reliability.
    # AI-generated cart values are unreliable (often wrong language).
    for _, sec in cur.get("sections", {}).items():
        if sec.get("type") != "cart-drawer":
            continue
        s = sec.get("settings", {})

        _rep(reps, "cart_button_text",       str(s.get("cart_button_text", "")),
             _cart_button.get(_lang2) or ai_ui.get("cart_button") or _cart_button["en"])
        _rep(reps, "cart_upsell_title",      str(s.get("cart_upsell_title", "")),
             _upsell_titles.get(_lang2) or ai_ui.get("cart_upsell_title") or _upsell_titles["en"])
        _rep(reps, "cart_upsell_button_text", str(s.get("cart_upsell_button_text", "")),
             _upsell_btn.get(_lang2) or ai_ui.get("cart_upsell_button") or _upsell_btn["en"])
        _rep(reps, "cart_protection_text",    str(s.get("cart_protection_text", "")),
             _protection.get(_lang2) or ai_ui.get("cart_protection") or _protection["en"])
        _rep(reps, "cart_savings_text",       str(s.get("cart_savings_text", "")),
             _savings.get(_lang2) or ai_ui.get("cart_savings") or _savings["en"])
        _rep(reps, "cart_subtotal_text",      str(s.get("cart_subtotal_text", "")),
             _subtotal.get(_lang2) or ai_ui.get("cart_subtotal") or _subtotal["en"])
        _rep(reps, "cart_total_text",         str(s.get("cart_total_text", "")),
             _total.get(_lang2) or ai_ui.get("cart_total") or _total["en"])
        _cart_footer_val = (
            _cart_footer.get(_lang2)
            or (f"<strong>{ai_ui['cart_footer']}</strong>" if ai_ui.get("cart_footer") else None)
            or _cart_footer["en"]
        )
        _rep(reps, "cart_footer_text",        str(s.get("cart_footer_text", "")),
             _cart_footer_val)

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

    # Fallback for themes that store cart settings as inline top-level keys in
    # current{} instead of a cart-drawer section (e.g. Sylys, Love themes).
    # These use: cart_button_text, cart_upsell_title, cart_upsell_button_text,
    # cart_protection_text, cart_savings_text, cart_subtotal_text, cart_total_text,
    # cart_footer_text, timer_timeout_text, cart_module_timer_text
    _has_inline_cart = any(k in cur for k in ("cart_button_text", "cart_module_timer_text"))
    _has_cart_drawer = any(s.get("type") == "cart-drawer" for s in cur.get("sections", {}).values())
    if _has_inline_cart and not _has_cart_drawer:
        _cart_footer_val_inline = (
            _cart_footer.get(_lang2)
            or (f"<strong>{ai_ui['cart_footer']}</strong>" if ai_ui.get("cart_footer") else None)
            or _cart_footer["en"]
        )
        _rep(reps, "cart_button_text",        str(cur.get("cart_button_text", "")),
             _cart_button.get(_lang2) or ai_ui.get("cart_button") or _cart_button["en"])
        _rep(reps, "cart_upsell_title",       str(cur.get("cart_upsell_title", "")),
             _upsell_titles.get(_lang2) or ai_ui.get("cart_upsell_title") or _upsell_titles["en"])
        _rep(reps, "cart_upsell_button_text", str(cur.get("cart_upsell_button_text", "")),
             _upsell_btn.get(_lang2) or ai_ui.get("cart_upsell_button") or _upsell_btn["en"])
        _rep(reps, "cart_protection_text",    str(cur.get("cart_protection_text", "")),
             _protection.get(_lang2) or ai_ui.get("cart_protection") or _protection["en"])
        _rep(reps, "cart_savings_text",       str(cur.get("cart_savings_text", "")),
             _savings.get(_lang2) or ai_ui.get("cart_savings") or _savings["en"])
        _rep(reps, "cart_subtotal_text",      str(cur.get("cart_subtotal_text", "")),
             _subtotal.get(_lang2) or ai_ui.get("cart_subtotal") or _subtotal["en"])
        _rep(reps, "cart_total_text",         str(cur.get("cart_total_text", "")),
             _total.get(_lang2) or ai_ui.get("cart_total") or _total["en"])
        _rep(reps, "cart_footer_text",        str(cur.get("cart_footer_text", "")),
             _cart_footer_val_inline)
        _rep(reps, "cart_module_timer_text",  str(cur.get("cart_module_timer_text", "")),
             timer_text)

    return apply_replacements(ed / rel, reps) > 0


# ── Locale file switching ─────────────────────────────────────────────────────

def _switch_locale_files(ed: Path, language: str) -> None:
    """Switch the theme's default storefront locale to the chosen language.

    Storefront locale files (*.json):
      1. Demote ALL existing *.default.json → *.json  (Shopify allows only one)
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

    # ── Build a case-insensitive map of all available locale files ────────────
    # On Linux (Render), filenames are case-sensitive. The theme uses mixed-case
    # codes like pt-BR.json, zh-CN.json, bg-BG.json — we must match robustly.
    #
    # Map: lowercase_stem → real_filename  (e.g. "pt-br" → "pt-BR")
    _locale_map: dict[str, str] = {}
    for f in locales_dir.iterdir():
        if not f.name.endswith(".json"):
            continue
        if ".schema" in f.name:
            continue
        # Strip .json and .default suffixes to get the language code
        stem = f.name
        if stem.endswith(".default.json"):
            stem = stem[: -len(".default.json")]
        else:
            stem = stem[: -len(".json")]
        _locale_map[stem.lower()] = stem  # key=lowercase, value=real case

    # ── Known code aliases (our LANGUAGES list vs theme locale file names) ────
    # e.g. user picks "no" but theme has "nb.json" (Norwegian Bokmål)
    #      user picks "zh" but theme has "zh-CN.json"
    _ALIASES: dict[str, list[str]] = {
        "no":    ["nb", "no"],          # Norwegian → Bokmål
        "zh":    ["zh-CN", "zh"],       # Chinese Simplified → zh-CN
        "pt":    ["pt-PT", "pt-BR", "pt"],  # generic Portuguese
        "bg":    ["bg-BG", "bg"],
        "hr":    ["hr-HR", "hr"],
        "lt":    ["lt-LT", "lt"],
        "ro":    ["ro-RO", "ro"],
        "sk":    ["sk-SK", "sk"],
        "sl":    ["sl-SI", "sl"],
    }

    # ── Find the real locale code in the theme ────────────────────────────────
    # Priority order:
    #   1. Exact match (case-insensitive)
    #   2. Alias list for this code
    #   3. Primary subtag prefix (e.g. "pt-br" → "pt")
    target_code: str | None = None

    codes_to_try: list[str] = [lang]
    codes_to_try += [a.lower() for a in _ALIASES.get(lang, [])]
    if "-" in lang:
        codes_to_try.append(lang.split("-")[0])  # "pt-br" → "pt"

    for code in codes_to_try:
        real = _locale_map.get(code.lower())
        if real:
            target_code = real
            break

    if not target_code:
        return

    # Demote any existing storefront default (e.g. fr.default.json or en.default.json)
    # — Shopify allows only ONE *.default.json AND only ONE *.default.schema.json.
    # We must demote BOTH the content file AND the schema file together.
    for existing_def in locales_dir.glob("*.default.json"):
        stem = existing_def.stem  # e.g. "fr.default"
        if stem.endswith(".schema"):
            continue
        lang_code = stem.replace(".default", "")  # e.g. "fr"
        if lang_code == target_code:
            continue  # already the target → keep as-is
        # Demote storefront content file: fr.default.json → fr.json
        demoted = locales_dir / f"{lang_code}.json"
        if demoted.exists():
            existing_def.unlink()   # fr.json already exists → remove the stale default
        else:
            existing_def.rename(demoted)
        # CRITICAL: also demote schema file: fr.default.schema.json → fr.schema.json
        # Without this, Shopify sees two "default" markers and invalidates the theme.
        old_schema = locales_dir / f"{lang_code}.default.schema.json"
        demoted_schema = locales_dir / f"{lang_code}.schema.json"
        if old_schema.exists():
            if demoted_schema.exists():
                old_schema.unlink()  # fr.schema.json already exists → remove orphan
            else:
                old_schema.rename(demoted_schema)

    # Promote target storefront locale to default (if not already done)
    t_json = locales_dir / f"{target_code}.json"
    t_def  = locales_dir / f"{target_code}.default.json"
    if t_json.exists() and not t_def.exists():
        t_json.rename(t_def)

    # Fill missing storefront keys from EN into the target locale.
    # Many Story-theme locale files (da, de, sv, etc.) are missing keys that only
    # exist in en.default.json (custom keys added by Story theme, e.g. general.timer.*).
    # Missing keys cause "translation missing: da.key" errors in the storefront.
    # Strategy: deep-merge EN keys into target, keeping existing target translations.
    en_locale_def = locales_dir / "en.default.json"
    en_locale_src = locales_dir / "en.json"   # if en was demoted earlier
    _en_locale = en_locale_def if en_locale_def.exists() else (en_locale_src if en_locale_src.exists() else None)
    if _en_locale and t_def.exists():
        _fill_missing_locale_keys(_en_locale, t_def)

    # Promote target schema file: da.schema.json → da.default.schema.json
    # This keeps the schema filename consistent with the content file.
    t_def_schema = locales_dir / f"{target_code}.default.schema.json"
    t_schema_src = locales_dir / f"{target_code}.schema.json"
    if t_schema_src.exists() and not t_def_schema.exists():
        t_schema_src.rename(t_def_schema)

    # Ensure {target}.default.schema.json has ALL keys from EN schema (fill gaps).
    # If it doesn't exist yet (no schema file in theme for this lang) → copy EN.
    # If it exists → merge EN into it so no "missing translation: t:..." in admin.
    en_schema_path = locales_dir / "en.default.schema.json"
    en_schema_src  = locales_dir / "en.schema.json"   # if en was demoted earlier
    _en_src = en_schema_path if en_schema_path.exists() else en_schema_src

    if _en_src.exists():
        if not t_def_schema.exists():
            import shutil as _shutil
            _shutil.copy2(_en_src, t_def_schema)
        else:
            _merge_schema_with_en(t_def_schema, _en_src, t_def_schema)


def _fill_missing_locale_keys(en_path: Path, target_path: Path) -> None:
    """Fill missing storefront translation keys from EN into the target locale file.

    Many non-English Story-theme locale files lack custom keys added only to EN/FR
    (e.g. general.timer.days, general.product_form.error, plural .many forms).
    This function deep-merges EN keys into the target, keeping all existing
    target translations intact — only adding what's absent.

    Reads/writes real Shopify locale JSON (handles /* */ comment headers).
    Output is written as UTF-8 JSON with the standard Shopify comment header.
    """
    import json as _json

    def _load(p: Path) -> dict | None:
        try:
            raw = p.read_bytes().decode("utf-8-sig", errors="replace")
            raw = re.sub(r"^/\*.*?\*/\s*", "", raw, flags=re.DOTALL)
            raw = re.sub(r",(\s*[}\]])", r"\1", raw)
            return _json.loads(raw)
        except Exception:
            return None

    def _deep_merge(base: dict, overlay: dict) -> dict:
        result = dict(base)
        for k, v in overlay.items():
            if k not in result:
                result[k] = v
            elif isinstance(v, dict) and isinstance(result.get(k), dict):
                result[k] = _deep_merge(result[k], v)
        return result

    en_data = _load(en_path)
    tgt_data = _load(target_path)
    if en_data is None or tgt_data is None:
        return

    merged = _deep_merge(tgt_data, en_data)
    if merged == tgt_data:
        return  # Nothing to add

    # Write with LF line endings + Shopify comment header (present in all original locale files)
    json_body = _json.dumps(merged, ensure_ascii=False, indent=2).replace("\r\n", "\n").replace("\r", "\n")
    target_path.write_bytes((_SHOPIFY_LOCALE_HEADER + json_body + "\n").encode("utf-8"))


def _merge_schema_with_en(fr_path: Path, en_path: Path, out_path: Path) -> None:
    """Merge EN schema keys into FR schema (in-place safe write).

    Reads both FR and EN schema JSON (handles comment headers + trailing commas).
    For every key present in EN but missing in FR, adds the EN value.
    Writes the merged result back to out_path in compact JSON format.
    """
    import json as _json

    def _load_shopify_schema(p: Path) -> dict | None:
        try:
            raw = p.read_bytes().decode("utf-8-sig", errors="replace")
            # Strip Shopify /* ... */ comment header
            raw = re.sub(r"^/\*.*?\*/\s*", "", raw, flags=re.DOTALL)
            # Strip trailing commas before ] or } (Shopify non-standard JSON)
            raw = re.sub(r",(\s*[}\]])", r"\1", raw)
            return _json.loads(raw)
        except Exception:
            return None

    def _deep_merge(base: dict, overlay: dict) -> dict:
        """Return base with missing keys filled from overlay (recursively)."""
        result = dict(base)
        for k, v in overlay.items():
            if k not in result:
                result[k] = v
            elif isinstance(v, dict) and isinstance(result.get(k), dict):
                result[k] = _deep_merge(result[k], v)
        return result

    fr_data = _load_shopify_schema(fr_path)
    en_data = _load_shopify_schema(en_path)

    if fr_data is None or en_data is None:
        # Fallback: just copy EN if FR can't be parsed
        if en_data is not None:
            import shutil as _shutil
            _shutil.copy2(en_path, out_path)
        return

    merged = _deep_merge(fr_data, en_data)

    # ── Inject keys missing from BOTH FR and EN schemas ───────────────────────
    # These are keys referenced in section liquid files but absent from all locale
    # schema files. We inject sensible multilingual values to prevent any remaining
    # "missing translation: t:sections.*" errors in the Shopify admin editor.
    #
    # Detected by scanning all sections/*.liquid files against both FR + EN schemas.
    _HARDCODED_PATCHES: dict[str, dict] = {
        # sections.global.alignement (typo variant of "alignment" used in e-tabs-alternate.liquid)
        # FR already has global.alignment.options with left/center/right, this fills the
        # alternate spelling so both keys resolve correctly.
        "sections": {
            "global": {
                "alignement": {
                    "options": {
                        "left":   "Gauche",
                        "center": "Centrer",
                        "right":  "Droite",
                    },
                },
                "button_text": {
                    # "default" is the pre-fill value for the button_text setting
                    # when a new block is added in the Shopify theme editor.
                    "default": "Acheter maintenant",
                },
            },
            "bundle": {
                # Fills free_label keys missing from FR schema
                "free_label": {
                    "label": "Label prix gratuit",
                    "info":  "Si vide, le zéro formaté en devise sera affiché (ex: 0,00 €).",
                },
            },
            "product": {
                "blocks": {
                    "price": {
                        "sale_badge": {
                            "info": "[percent] sera remplacé par le pourcentage de réduction et [amount] par le montant.",
                        },
                    },
                },
            },
        },
    }

    merged = _deep_merge(merged, _HARDCODED_PATCHES)

    # Write with LF line endings + Shopify comment header (present in all original locale files)
    json_body = _json.dumps(merged, ensure_ascii=False, indent=2).replace("\r\n", "\n").replace("\r", "\n")
    out_path.write_bytes((_SHOPIFY_LOCALE_HEADER + json_body + "\n").encode("utf-8"))
