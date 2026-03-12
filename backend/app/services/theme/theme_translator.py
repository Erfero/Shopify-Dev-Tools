"""
Theme Translator — translates remaining French text fields to the chosen language.

Runs AFTER apply_generated_texts(), only when language != 'fr'.
Strategy:
  1. Walk all editable JSON files and collect (rel_path, field, current_value) triples
     for every text-like settings field.
  2. Batch-send the values to the AI for translation.
  3. Apply text-surgery replacements so every previously-untouched French string
     becomes the target language.

The AI will leave already-translated strings unchanged (they are already in the
target language) and translate only the ones that are still in French.
"""
import json
import logging
import re
from collections import defaultdict
from pathlib import Path

from app.services.theme.text_surgery import apply_replacements

logger = logging.getLogger(__name__)

# How many strings to send in one API call
BATCH_SIZE = 60

# ── Field classification ───────────────────────────────────────────────────────

# Keys that are always text content
_TEXT_KEYS = frozenset({
    "heading", "subheading", "title", "text", "description", "content",
    "button_text", "label", "placeholder", "row_content", "tooltip",
    "text_footer", "newsletter_heading", "newsletter_text",
    "today_info", "ready_info", "delivered_info", "announcement",
    "brand_text", "marquee",
    "order_number", "track",  # contact & tracking pages
})

# Suffixes that indicate text content
_TEXT_SUFFIXES = (
    "_text", "_heading", "_title", "_description",
    "_content", "_label", "_tooltip",
)

# Regex for numbered variants like heading1, text2, icon_1_text
_TEXT_PATTERN = re.compile(
    r"(?:heading|subheading|title|text|description|content|label|"
    r"tooltip|newsletter|announcement|row_content|button)(?:[_-]?\d+)?$",
    re.IGNORECASE,
)

# Keys that are definitely NOT text
_SKIP_KEYS = frozenset({
    "id", "type", "url", "image", "video", "font_size", "padding",
    "margin", "width", "height", "opacity", "color", "background",
    "alignment", "position", "icon", "product", "collection",
    "border_radius", "border_width", "columns", "gap", "style",
    "ratio", "sizes", "layout", "format", "target", "rel",
})

# Regex patterns for non-text values
_HEX_COLOR = re.compile(r"^#[0-9a-fA-F]{3,8}$")
_URL = re.compile(r"^https?://")
_HANDLE = re.compile(r"^[a-z0-9][a-z0-9_-]*$")  # Shopify handles
_NUMERIC = re.compile(r"^[\d\s,./%-]+$")


def _is_translatable(key: str, val) -> bool:
    """Return True if this (key, value) pair should be sent for translation."""
    if not isinstance(val, str):
        return False
    v = val.strip()
    if len(v) < 3:
        return False

    # Value-based exclusions
    if _HEX_COLOR.match(v):
        return False
    if _URL.match(v):
        return False
    if _NUMERIC.match(v):
        return False
    # Shopify handle-like values (no spaces, short, lowercase)
    if _HANDLE.match(v) and " " not in v and len(v) < 50:
        return False

    key_l = key.lower()

    if key_l in _SKIP_KEYS:
        return False
    if key_l in _TEXT_KEYS:
        return True
    for suf in _TEXT_SUFFIXES:
        if key_l.endswith(suf):
            return True
    if _TEXT_PATTERN.search(key_l):
        return True

    return False


# ── Collection ─────────────────────────────────────────────────────────────────

def _collect_from_settings(settings_dict: dict, collector: list, rel_path: str) -> None:
    if not isinstance(settings_dict, dict):
        return
    for key, val in settings_dict.items():
        if _is_translatable(key, val):
            collector.append((rel_path, key, val.strip()))


def _walk(node, collector: list, rel_path: str) -> None:
    """Recursively walk a JSON node and collect translatable settings values."""
    if not isinstance(node, dict):
        return

    # Collect from "settings" dict at this level
    if "settings" in node and isinstance(node["settings"], dict):
        _collect_from_settings(node["settings"], collector, rel_path)

    # Recurse into container keys
    for container_key in ("sections", "blocks", "current"):
        container = node.get(container_key)
        if isinstance(container, dict):
            for child in container.values():
                _walk(child, collector, rel_path)

    # For settings_data.json the top-level "current" dict also has
    # direct text fields (e.g. product_card_button_text, timer_timeout_text).
    # Those are already picked up by _collect_from_settings when we reach them
    # after recursing into "current" → we treat the "current" dict itself
    # as if it were a settings dict by calling _collect_from_settings on it.
    if "current" in node and isinstance(node["current"], dict):
        # Direct fields on current (not inside a "settings" sub-dict)
        for key, val in node["current"].items():
            if key not in ("sections", "blocks") and _is_translatable(key, val):
                collector.append((rel_path, key, val.strip()))


def collect_all_texts(parsed_files: dict) -> list[tuple[str, str, str]]:
    """Walk all parsed theme files and collect (rel_path, field, value) triples."""
    raw: list[tuple[str, str, str]] = []

    for rel_path, entry in parsed_files.items():
        if not rel_path.startswith(("templates/", "sections/", "config/")):
            continue
        data, _, _ = entry
        _walk(data, raw, rel_path)

    # Deduplicate — keep unique (rel_path, field, value) triples
    seen: set[tuple[str, str, str]] = set()
    result: list[tuple[str, str, str]] = []
    for item in raw:
        if item not in seen:
            seen.add(item)
            result.append(item)

    return result


# ── Translation API call ───────────────────────────────────────────────────────

async def _translate_batch(texts: list[str], language: str) -> list[str]:
    """Send a batch of strings to the AI for translation. Returns translated list."""
    from app.services.theme.ai_generator import call_openrouter  # late import to avoid cycles

    system_prompt = (
        f"You are a professional translator. Your task is to translate an array of "
        f"strings into {language}.\n\n"
        "Rules:\n"
        f"- Return ONLY a valid JSON object: {{\"translations\": [...]}}\n"
        f"- The array must have EXACTLY the same number of elements as the input.\n"
        "- Preserve HTML tags exactly (e.g. <p>, <strong>, <br>) — translate only the text inside.\n"
        "- Do NOT translate: brand names, proper nouns, URLs, code, variables.\n"
        f"- If a string is already in {language}, keep it unchanged.\n"
        "- Preserve emojis and special characters."
    )

    user_prompt = (
        f"Translate each string in the following JSON array to {language}.\n"
        f"Input: {json.dumps(texts, ensure_ascii=False)}"
    )

    result = await call_openrouter(system_prompt, user_prompt)

    # Extract the translations array
    if isinstance(result, list):
        return result
    if isinstance(result, dict):
        for key in ("translations", "result", "texts", "output", "translated"):
            if key in result and isinstance(result[key], list):
                return result[key]

    logger.warning(f"Unexpected translation response: {type(result)} — {str(result)[:200]}")
    return texts  # Fallback: return originals unchanged


# ── Main entry point ───────────────────────────────────────────────────────────

async def translate_remaining_texts(
    extract_dir: Path,
    parsed_files: dict,
    language: str,
) -> None:
    """Translate all remaining French text fields in the theme to `language`.

    No-op for French. Applies text-surgery replacements directly to files.
    Called after apply_generated_texts() so AI-generated content (already in
    the target language) is left untouched by the AI translator.
    """
    lang = language.strip().lower()
    if lang.startswith("fr"):
        return

    all_items = collect_all_texts(parsed_files)
    if not all_items:
        logger.info("translate_remaining_texts: no translatable fields found.")
        return

    logger.info(
        f"translate_remaining_texts: translating {len(all_items)} fields to {language}."
    )

    values = [item[2] for item in all_items]

    # Translate in batches
    translated: list[str] = []
    for i in range(0, len(values), BATCH_SIZE):
        batch = values[i : i + BATCH_SIZE]
        try:
            batch_result = await _translate_batch(batch, language)
            # Guard against short responses
            if len(batch_result) < len(batch):
                logger.warning(
                    f"Batch {i // BATCH_SIZE + 1}: got {len(batch_result)} "
                    f"translations for {len(batch)} inputs — padding with originals."
                )
                batch_result = list(batch_result) + batch[len(batch_result):]
            elif len(batch_result) > len(batch):
                batch_result = batch_result[: len(batch)]
            translated.extend(batch_result)
        except Exception as exc:
            logger.error(f"Translation batch {i // BATCH_SIZE + 1} failed: {exc}")
            translated.extend(batch)  # Keep originals on error

    # Build replacements grouped by file
    reps_by_file: dict[str, list[tuple[str, str, str]]] = defaultdict(list)
    for (rel_path, field, old_val), new_val in zip(all_items, translated):
        if isinstance(new_val, str) and new_val.strip() and new_val != old_val:
            reps_by_file[rel_path].append((field, old_val, new_val))

    # Apply text surgery per file
    total = 0
    for rel_path, reps in reps_by_file.items():
        file_path = extract_dir / rel_path
        if file_path.exists():
            n = apply_replacements(file_path, reps)
            total += n
            if n:
                logger.info(f"  {rel_path}: {n} translations applied.")

    logger.info(f"translate_remaining_texts: {total} replacements applied across {len(reps_by_file)} files.")
