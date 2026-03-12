from dataclasses import dataclass, field


@dataclass
class TextSlot:
    """Represents a single editable text field in the theme."""
    file_path: str        # Relative path within theme (e.g., "templates/index.json")
    json_path: str        # Dot-notation path to the value (e.g., "sections.banner_id.blocks.block_id.settings.heading")
    current_value: str    # Current text value
    field_key: str        # The settings key name (e.g., "heading", "description")
    section_type: str     # The section type (e.g., "banner", "rich-text")
    context: str          # Semantic context (e.g., "homepage_banner_heading")


# Keys that contain editable text content
EDITABLE_TEXT_KEYS = {
    # Common section/block settings
    "heading", "subheading", "description", "text", "button_text",
    "button_text_secondary", "title", "row_content", "subtitle",
    # Review blocks
    "author_name", "author_age",
    # Icon-with-text block (numbered fields)
    "icon_1_text", "icon_2_text", "icon_3_text", "icon_4_text",
    "icon_1_description", "icon_2_description", "icon_3_description", "icon_4_description",
    # Description-FAQ block (numbered fields)
    "heading1", "heading2", "heading3", "heading4",
    "text1", "text2", "text3", "text4",
    # Comparison list
    "tooltip",
    # Footer
    "text_footer",
    # Sale badge
    "sale_badge",
    # Cart/global settings
    "cart_button_text", "cart_upsell_title", "cart_protection_text",
    "cart_footer_text", "cart_savings_text", "cart_subtotal_text",
    "cart_total_text", "timer_timeout_text",
    "today_info", "ready_info", "delivered_info",
    "product_card_button_text", "collection_card_button_text",
    # Announcement bar
    "text_secondary",
    # Brand
    "brand_heading_2", "brand_description",
    # Review block numbered
    "heading1", "text1", "heading2", "text2", "heading3", "text3",
    "rating1", "rating2", "rating3",
}

# Keys to skip even if they match (structural, not content)
SKIP_KEYS = {"section_id", "custom_liquid"}


def extract_text_slots(parsed_files: dict[str, tuple]) -> list[TextSlot]:
    """Extract all editable text slots from parsed theme files.

    Args:
        parsed_files: Dict of {relative_path: (data, comment_header, is_compact)}

    Returns:
        List of TextSlot objects representing all editable text fields
    """
    slots = []

    for file_path, file_info in parsed_files.items():
        data = file_info[0]
        if file_path == "config/settings_data.json":
            slots.extend(_extract_settings_data_slots(file_path, data))
        else:
            slots.extend(_extract_template_slots(file_path, data))

    return slots


def _extract_template_slots(file_path: str, data: dict) -> list[TextSlot]:
    """Extract text slots from a template or section-group JSON."""
    slots = []
    sections = data.get("sections", {})

    for section_id, section in sections.items():
        section_type = section.get("type", "unknown")

        # Section-level settings
        section_settings = section.get("settings", {})
        for key, value in section_settings.items():
            if key in EDITABLE_TEXT_KEYS and key not in SKIP_KEYS and isinstance(value, str) and value.strip():
                slots.append(TextSlot(
                    file_path=file_path,
                    json_path=f"sections.{section_id}.settings.{key}",
                    current_value=value,
                    field_key=key,
                    section_type=section_type,
                    context=f"{section_type}_{key}",
                ))

        # Block-level settings
        blocks = section.get("blocks", {})
        for block_id, block in blocks.items():
            block_type = block.get("type", "unknown")
            block_settings = block.get("settings", {})

            for key, value in block_settings.items():
                if key in EDITABLE_TEXT_KEYS and key not in SKIP_KEYS and isinstance(value, str) and value.strip():
                    slots.append(TextSlot(
                        file_path=file_path,
                        json_path=f"sections.{section_id}.blocks.{block_id}.settings.{key}",
                        current_value=value,
                        field_key=key,
                        section_type=section_type,
                        context=f"{section_type}_{block_type}_{key}",
                    ))

    return slots


def _extract_settings_data_slots(file_path: str, data: dict) -> list[TextSlot]:
    """Extract text slots from config/settings_data.json."""
    slots = []
    current = data.get("current", {})

    # Top-level text settings
    for key, value in current.items():
        if key in EDITABLE_TEXT_KEYS and isinstance(value, str) and value.strip():
            slots.append(TextSlot(
                file_path=file_path,
                json_path=f"current.{key}",
                current_value=value,
                field_key=key,
                section_type="global_settings",
                context=f"global_{key}",
            ))

    # Sections within settings_data (cart-drawer, main-sticky-atc)
    sections = current.get("sections", {})
    for section_id, section in sections.items():
        section_type = section.get("type", "unknown")
        section_settings = section.get("settings", {})

        for key, value in section_settings.items():
            if key in EDITABLE_TEXT_KEYS and isinstance(value, str) and value.strip():
                slots.append(TextSlot(
                    file_path=file_path,
                    json_path=f"current.sections.{section_id}.settings.{key}",
                    current_value=value,
                    field_key=key,
                    section_type=section_type,
                    context=f"settings_{section_type}_{key}",
                ))

        # Blocks within settings_data sections
        blocks = section.get("blocks", {})
        for block_id, block in blocks.items():
            block_type = block.get("type", "unknown")
            block_settings = block.get("settings", {})
            for key, value in block_settings.items():
                if key in EDITABLE_TEXT_KEYS and isinstance(value, str) and value.strip():
                    slots.append(TextSlot(
                        file_path=file_path,
                        json_path=f"current.sections.{section_id}.blocks.{block_id}.settings.{key}",
                        current_value=value,
                        field_key=key,
                        section_type=section_type,
                        context=f"settings_{section_type}_{block_type}_{key}",
                    ))

    return slots
