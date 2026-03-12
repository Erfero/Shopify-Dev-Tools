import zipfile
import json
from pathlib import Path

from app.config import settings
from app.utils.json_handler import write_theme_json


# Directories to exclude from the output ZIP (internal temp files)
EXCLUDED_DIRS = {"_product_images"}

# Individual files to exclude (internal metadata)
EXCLUDED_FILES = {"_session_meta.json"}


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
    safe_name = re.sub(r"[^\w\-]", "_", store_name).strip("_").lower() if store_name else session_id[:8]
    zip_path = settings.temp_path / f"theme_story_{safe_name}.zip"
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


def _create_zip(source_dir: Path, zip_path: Path):
    """Create a ZIP file from a directory, excluding internal temp directories."""
    with zipfile.ZipFile(zip_path, "w", zipfile.ZIP_DEFLATED) as zf:
        for file_path in sorted(source_dir.rglob("*")):
            if file_path.is_file():
                rel = file_path.relative_to(source_dir)
                # Skip excluded directories (e.g., _product_images)
                if rel.parts and rel.parts[0] in EXCLUDED_DIRS:
                    continue
                # Skip excluded files (e.g., _session_meta.json)
                if rel.name in EXCLUDED_FILES:
                    continue
                zf.write(file_path, rel)
