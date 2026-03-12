import json
import re
from pathlib import Path


# Pattern to match the Shopify auto-generated comment header
COMMENT_PATTERN = re.compile(r"^(/\*[\s\S]*?\*/)\s*", re.MULTILINE)


def read_theme_json(file_path: Path) -> tuple[dict, str | None]:
    """Read a theme JSON file, stripping the comment header if present.

    Returns:
        Tuple of (parsed_data, comment_header or None)
    """
    content = file_path.read_text(encoding="utf-8")
    comment_header = None

    match = COMMENT_PATTERN.match(content)
    if match:
        comment_header = match.group(1)
        content = content[match.end():]

    data = json.loads(content)
    return data, comment_header


def detect_json_format(file_path: Path) -> bool:
    """Detect whether a JSON file uses compact or pretty-printed format.

    Returns:
        True if compact (no indentation), False if pretty-printed.
    """
    raw = file_path.read_text(encoding="utf-8")
    match = COMMENT_PATTERN.match(raw)
    json_part = raw[match.end():] if match else raw

    # Compact JSON starts with {"key": without newlines
    # Pretty JSON starts with {\n  "key":
    return "\n  " not in json_part[:200]


def write_theme_json(file_path: Path, data: dict, comment_header: str | None = None, compact: bool = True):
    """Write a theme JSON file, re-adding the comment header if it was present.

    Args:
        file_path: Path to write to
        data: JSON data to write
        comment_header: Optional comment header to prepend
        compact: If True, use compact serialization (no whitespace). If False, use indented.
    """
    if compact:
        json_str = json.dumps(data, ensure_ascii=False, separators=(",", ":"))
    else:
        json_str = json.dumps(data, ensure_ascii=False, indent=2)

    # Re-escape forward slashes to match Shopify's JSON convention.
    # Shopify uses \/ in URLs (shopify:\/\/shop_images\/...) and HTML
    # closing tags (<\/strong>, <\/p>). Python's json.dumps never produces
    # \/ so we must restore it. Both / and \/ are valid JSON.
    json_str = json_str.replace("/", "\\/")

    if comment_header:
        output = f"{comment_header}\n{json_str}\n"
    else:
        output = json_str

    file_path.write_text(output, encoding="utf-8")
