import logging
import zipfile
import json
from pathlib import Path

from app.config import settings
from app.utils.json_handler import write_theme_json

logger = logging.getLogger(__name__)


# Directories to exclude from the output ZIP (internal temp files)
EXCLUDED_DIRS = {"_product_images"}

# Individual files to exclude (internal metadata)
EXCLUDED_FILES = {"_session_meta.json"}


# Friendly French titles for known page templates. Any page.*.json not listed here
# still gets reported (with a title guessed from its suffix) so new templates added
# by a future base-theme update are never silently dropped from the checklist.
_PAGE_TEMPLATE_LABELS = {
    "contact": "Contact",
    "faq": "FAQ",
    "help": "Aide",
    "story": "Notre histoire",
    "tracking": "Suivi de commande",
    "wishlist": "Liste de souhaits",
}


def required_pages(theme_root: Path) -> list[dict]:
    """List custom page templates that need a matching Shopify Page created manually.

    Shipping templates/page.story.json (etc.) inside the theme ZIP is not enough on
    its own: Shopify only renders that template for a Page resource that a merchant
    creates in Admin → Online Store → Pages and explicitly assigns "page.story" to
    via the Theme template dropdown. Skipping that step is the single most common
    reason a freshly generated theme "seems to be missing pages" or 404s when you
    look for them in the theme editor's page picker — the theme isn't broken, the
    Page resource simply doesn't exist yet.

    Derived dynamically from whichever templates/page.*.json files are present at
    export time, so this stays correct for any current or future base theme version
    without needing an update here.
    """
    templates_dir = theme_root / "templates"
    if not templates_dir.exists():
        return []
    pages = []
    for f in sorted(templates_dir.glob("page.*.json")):
        suffix = f.stem[len("page."):]  # "page.story.json" → stem "page.story" → "story"
        if not suffix:
            continue
        pages.append({
            "template_suffix": suffix,
            "suggested_title": _PAGE_TEMPLATE_LABELS.get(suffix, suffix.replace("-", " ").replace("_", " ").title()),
        })
    return pages


def export_theme(session_id: str, theme_root: Path, modified_files: set[str], store_name: str = "") -> Path:
    """Create a ZIP from the theme directory.

    Files were already modified in-place by the text surgery step.
    Unmodified files are byte-for-byte identical to the originals.

    Args:
        session_id: Session identifier
        theme_root: Path to the extracted (and already-modified) theme root
        modified_files: Set of relative paths that were changed (for logging only)
        store_name: Store name used to build the ZIP filename

    Returns:
        Path to the generated ZIP file
    """
    import re
    safe_name = re.sub(r"[^\w\-]", "_", store_name).strip("_") if store_name else session_id[:8]
    zip_path = settings.temp_path / f"Theme_Story_{safe_name}.zip"
    _create_zip(theme_root, zip_path)
    return zip_path


def create_legal_page_template(theme_root: Path, page_handle: str, title: str, content_html: str):
    """Create a new page template for legal pages.

    Uses a simple rich-text section structure matching the theme's pattern.

    Args:
        theme_root: Path to the extracted theme root
        page_handle: The page handle (e.g., "conditions-de-vente")
        title: Page title
        content_html: HTML content for the page
    """
    template = {
        "sections": {
            "main": {
                "type": "rich-text",
                "blocks": {
                    "heading_main": {
                        "type": "heading",
                        "settings": {
                            "subheading": "",
                            "heading": title,
                            "heading_style": "1"
                        }
                    },
                    "text_main": {
                        "type": "text",
                        "settings": {
                            "description": content_html,
                            "color_bold_words": "text"
                        }
                    }
                },
                "block_order": ["heading_main", "text_main"],
                "settings": {
                    "section_id": "",
                    "alignment": "left",
                    "enable_animations": True,
                    "animation": "fade-up",
                    "layout_width": "normal",
                    "padding_top": 36,
                    "padding_bottom": 36,
                    "padding_top_sm": 24,
                    "padding_bottom_sm": 24,
                    "color_palette": "background-1",
                    "enable_cut_bg_color": False,
                    "cut_bg_color": "#f6f6f6",
                    "cut_bg_color_vertical": 0,
                    "cut_bg_color_vertical_mobile": 0,
                    "cut_bg_color_horizontal": 0,
                    "cut_bg_color_horizontal_mobile": 0,
                    "separator_top": "none",
                    "separator_top_invert": False,
                    "separator_bottom": "none",
                    "separator_bottom_invert": False,
                    "separator_animated": False,
                    "separator_bg_color": ""
                }
            }
        },
        "order": ["main"]
    }

    file_path = theme_root / "templates" / f"page.{page_handle}.json"
    # Legal pages are new files - use pretty format (indent=2) to match
    # the theme's convention for page templates with comment headers
    write_theme_json(file_path, template, compact=False)


def _repair_dangling_block_order(source_dir: Path) -> int:
    """Final safety net: prune block_order entries with no matching block.

    Shopify rejects a template/section-group whose block_order array references a
    block id absent from its blocks object (this is how a missing product image
    with-text block, a dropped 'social_proof' block, or any other block deleted
    without updating block_order turns into a 404 on the storefront). Earlier
    pipeline steps are expected to keep these in sync, but this check runs
    unconditionally right before zipping so that ANY current or future code path
    that edits blocks — in this app or in an upstream base-theme update — can never
    ship a broken reference. Pure data-integrity fix: removing a dangling id from
    block_order never changes what a shopper sees, it only removes something that
    would otherwise fail to render.
    """
    repaired = 0
    candidates = list(source_dir.glob("templates/**/*.json")) + list(source_dir.glob("sections/*.json"))
    for f in candidates:
        try:
            data = json.loads(f.read_text(encoding="utf-8-sig"))
        except Exception:
            continue
        sections = data.get("sections") if isinstance(data, dict) else None
        if not isinstance(sections, dict):
            continue
        changed = False
        for sec in sections.values():
            if not isinstance(sec, dict):
                continue
            block_order = sec.get("block_order")
            blocks = sec.get("blocks")
            if not block_order or not isinstance(blocks, dict):
                continue
            new_order = [b for b in block_order if b in blocks]
            if new_order != block_order:
                sec["block_order"] = new_order
                changed = True
                repaired += len(block_order) - len(new_order)
        if changed:
            json_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
            f.write_text(json_str.replace("/", "\\/"), encoding="utf-8")
    if repaired:
        logger.warning(
            f"_repair_dangling_block_order: pruned {repaired} dangling block_order "
            f"reference(s) before export — check upstream generation logic"
        )
    return repaired


def _create_zip(source_dir: Path, zip_path: Path):
    """Create a ZIP file from a directory, excluding internal temp directories."""
    # Verify required files exist before starting
    for required in ("layout/theme.liquid", "templates/product.json", "templates/index.json"):
        if not (source_dir / required).exists():
            raise FileNotFoundError(
                f"{required} manquant dans le répertoire theme: {source_dir}"
            )

    _repair_dangling_block_order(source_dir)

    # Guard: Shopify allows only ONE *.default.json and ONE *.default.schema.json.
    # If _switch_locale_files() left duplicates, abort before producing a broken ZIP.
    locales_dir = source_dir / "locales"
    if locales_dir.exists():
        default_content = [f.name for f in locales_dir.glob("*.default.json") if ".schema" not in f.name]
        default_schema  = [f.name for f in locales_dir.glob("*.default.schema.json")]
        if len(default_content) > 1:
            raise ValueError(
                f"Plusieurs fichiers *.default.json trouvés dans locales/: {default_content}. "
                "Le thème sera rejeté par Shopify."
            )
        if len(default_schema) > 1:
            raise ValueError(
                f"Plusieurs fichiers *.default.schema.json trouvés dans locales/: {default_schema}. "
                "Le thème sera rejeté par Shopify."
            )

    # Collect all files first so we can detect issues before writing the ZIP
    files_to_add: list[tuple[Path, str]] = []
    for file_path in sorted(source_dir.rglob("*")):
        if not file_path.is_file():
            continue
        rel = file_path.relative_to(source_dir)
        if rel.parts and rel.parts[0] in EXCLUDED_DIRS:
            continue
        if rel.name in EXCLUDED_FILES:
            continue
        # Use POSIX separators (forward slashes) in the archive — required for Shopify
        files_to_add.append((file_path, rel.as_posix()))

    logger.info(f"_create_zip: {len(files_to_add)} files → {zip_path.name}")

    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path, arcname in files_to_add:
            try:
                zf.write(file_path, arcname)
            except Exception as e:
                logger.warning(f"_create_zip: skipping {arcname} ({e})")
