import zipfile
import uuid
import shutil
from pathlib import Path

from app.config import settings
from app.utils.json_handler import read_theme_json, detect_json_format


# Files that contain editable text content
EDITABLE_JSON_FILES = [
    "templates/index.json",
    "templates/product.json",
    "templates/page.story.json",
    "templates/page.contact.json",
    "templates/page.faq.json",
    "templates/page.help.json",
    "templates/page.tracking.json",
    "templates/page.json",
    "config/settings_data.json",
    "sections/header-group.json",
    "sections/footer-group.json",
]


class ThemeStructure:
    def __init__(self, session_id: str, extract_dir: Path):
        self.session_id = session_id
        self.extract_dir = extract_dir
        # {rel_path: (parsed_data, comment_header, is_compact)}
        self.parsed_files: dict[str, tuple[dict, str | None, bool]] = {}
        self.templates_found: list[str] = []
        self.theme_name: str = ""

    @property
    def sections_count(self) -> int:
        count = 0
        for rel_path, (data, _, _) in self.parsed_files.items():
            if "sections" in data:
                count += len(data["sections"])
        return count


def extract_theme(zip_file_path: Path) -> ThemeStructure:
    """Extract a theme ZIP and parse all editable JSON files.

    Args:
        zip_file_path: Path to the uploaded ZIP file

    Returns:
        ThemeStructure with parsed files and metadata
    """
    session_id = str(uuid.uuid4())
    extract_dir = settings.temp_path / session_id

    with zipfile.ZipFile(zip_file_path, "r") as zf:
        zf.extractall(extract_dir)

    # Detect theme root (might be nested in a folder)
    theme_root = _find_theme_root(extract_dir)

    structure = ThemeStructure(session_id=session_id, extract_dir=theme_root)

    # Try to detect theme name from the directory
    if theme_root != extract_dir:
        structure.theme_name = theme_root.name
    else:
        structure.theme_name = "Story Theme"

    # Parse each editable JSON file, storing original format
    for rel_path in EDITABLE_JSON_FILES:
        file_path = theme_root / rel_path
        if file_path.exists():
            data, comment = read_theme_json(file_path)
            is_compact = detect_json_format(file_path)
            structure.parsed_files[rel_path] = (data, comment, is_compact)
            if rel_path.startswith("templates/"):
                structure.templates_found.append(rel_path)

    return structure


def _find_theme_root(extract_dir: Path) -> Path:
    """Find the actual theme root directory.

    Sometimes the ZIP contains a top-level folder wrapping the theme.
    The theme root is identified by the presence of templates/ and config/ dirs.
    """
    # Check if extract_dir itself is the theme root
    if (extract_dir / "templates").is_dir() and (extract_dir / "config").is_dir():
        return extract_dir

    # Check one level deep
    for child in extract_dir.iterdir():
        if child.is_dir():
            if (child / "templates").is_dir() and (child / "config").is_dir():
                return child

    # Fallback to extract_dir
    return extract_dir


def cleanup_session(session_id: str):
    """Remove the temporary directory for a session."""
    session_dir = settings.temp_path / session_id
    if session_dir.exists():
        shutil.rmtree(session_dir)
