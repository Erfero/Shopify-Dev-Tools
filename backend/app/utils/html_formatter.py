import re


def to_shopify_richtext(text: str) -> str:
    """Convert plain text or markdown-like text to Shopify richtext HTML.

    Ensures text is wrapped in <p> tags and bold markers are converted to <strong>.
    """
    if not text:
        return "<p></p>"

    # If already contains HTML tags, return as-is
    if "<p>" in text or "<ul>" in text or "<h" in text:
        return text

    # Convert **bold** to <strong>bold</strong>
    text = re.sub(r"\*\*(.*?)\*\*", r"<strong>\1</strong>", text)

    # Wrap in <p> if not already
    if not text.startswith("<p>"):
        text = f"<p>{text}</p>"

    return text


def escape_for_json(html: str) -> str:
    """Escape forward slashes for Shopify JSON format."""
    return html.replace("/", "\\/")
