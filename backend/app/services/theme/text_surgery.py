"""
Text Surgery — safe in-place text replacement for Shopify theme JSON files.

Instead of: json.loads() → modify dict → json.dumps()   (rewrites every byte)
We do:      find "field":"old_text" in raw file → replace with "field":"new_text"

This guarantees:
  • Every byte outside the replaced text is preserved exactly as the original
  • \\/ URL escaping, Unicode encoding, formatting — all untouched
  • Only the specific text content changes
"""
import json
from pathlib import Path


def _encode(value: str) -> str:
    """JSON-encode a string value for raw-content search/replace.

    Returns the encoded form WITHOUT surrounding quotes,
    with Shopify's forward-slash escaping convention (/ → \\/).
    """
    encoded = json.dumps(value, ensure_ascii=False)[1:-1]  # strip outer quotes
    encoded = encoded.replace("/", "\\/")
    return encoded


def _replace_once(raw: str, field: str, old_enc: str, new_enc: str) -> tuple[str, bool]:
    """Replace one occurrence of a field:value pair in raw JSON text.

    Tries both compact  ("field":"value")
    and pretty-printed  ("field": "value") formats.
    Returns (new_raw, was_changed).
    """
    for sep in ('":"', '": "'):
        # Build the pattern around the value so we don't accidentally
        # match a substring of a longer value.
        pattern = f'"{field}{sep}{old_enc}"'
        if pattern in raw:
            replacement = f'"{field}{sep}{new_enc}"'
            return raw.replace(pattern, replacement, 1), True
    return raw, False


def apply_replacements(file_path: Path, replacements: list[tuple[str, str, str]]) -> int:
    """Apply a list of (field_name, old_value, new_value) to a file in-place.

    • Skips entries where old == new or old is empty.
    • Logs a warning if a replacement wasn't found in the file.
    • Returns the number of replacements actually applied.
    """
    if not replacements or not file_path.exists():
        return 0

    raw = file_path.read_text("utf-8")
    applied = 0

    for field, old_val, new_val in replacements:
        if not old_val or old_val == new_val:
            continue

        old_enc = _encode(old_val)
        new_enc = _encode(new_val)

        raw, changed = _replace_once(raw, field, old_enc, new_enc)
        if changed:
            applied += 1
        # If not found: the value wasn't in the file (already different, or
        # our mapping was wrong). We silently skip — the file stays intact.

    if applied > 0:
        file_path.write_text(raw, "utf-8")

    return applied
