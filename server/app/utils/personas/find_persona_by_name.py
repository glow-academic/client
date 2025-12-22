"""Utility function to find persona by name."""

import uuid
from typing import Any

from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


def sanitize_persona_name(name: str) -> str:
    """Sanitize persona name for use in matching (case-insensitive)."""
    # Remove special characters, replace spaces with underscores, lowercase
    sanitized = "".join(c if c.isalnum() or c == " " else "" for c in name)
    sanitized = sanitized.replace(" ", "_").lower()
    return sanitized or "persona"


def find_persona_by_name(
    persona_name: str, personas: list[dict[str, Any]]
) -> tuple[uuid.UUID, str] | None:
    """Find persona by name (robust case-insensitive matching with whitespace handling).

    Args:
        persona_name: Name to search for (will be normalized)
        personas: List of persona dicts with 'persona_id'/'id' and 'persona_name'/'name' keys

    Returns:
        Tuple of (persona_id, persona_name) if found, None otherwise
    """
    # Normalize input: strip whitespace and handle empty strings
    if not persona_name or not persona_name.strip():
        return None

    persona_name_normalized = persona_name.strip()
    sanitized_search = sanitize_persona_name(persona_name_normalized)

    # Try exact matches first (case-insensitive)
    for persona in personas:
        # Handle both 'id'/'name' and 'persona_id'/'persona_name' field names
        persona_id_str = persona.get("persona_id") or persona.get("id")
        if not persona_id_str:
            continue

        persona_display_name = persona.get("persona_name") or persona.get("name", "")
        if not persona_display_name:
            continue

        # Try multiple matching strategies:
        # 1. Exact case-insensitive match (normalized)
        if persona_name_normalized.lower() == persona_display_name.lower():
            try:
                persona_id = uuid.UUID(str(persona_id_str))
                return (persona_id, persona_display_name)
            except (ValueError, TypeError):
                logger.warning(f"Invalid persona_id format: {persona_id_str}")
                continue

        # 2. Sanitized match (handles special characters)
        sanitized_persona = sanitize_persona_name(persona_display_name)
        if sanitized_search == sanitized_persona:
            try:
                persona_id = uuid.UUID(str(persona_id_str))
                return (persona_id, persona_display_name)
            except (ValueError, TypeError):
                logger.warning(f"Invalid persona_id format: {persona_id_str}")
                continue

    # If no exact match found, try fuzzy matching (contains check)
    # This helps if the model provides a partial name or slightly different wording
    for persona in personas:
        persona_id_str = persona.get("persona_id") or persona.get("id")
        if not persona_id_str:
            continue

        persona_display_name = persona.get("persona_name") or persona.get("name", "")
        if not persona_display_name:
            continue

        # Check if the search term is contained in the persona name (case-insensitive)
        if persona_name_normalized.lower() in persona_display_name.lower():
            try:
                persona_id = uuid.UUID(str(persona_id_str))
                logger.info(
                    f"Fuzzy matched persona '{persona_name_normalized}' to '{persona_display_name}'"
                )
                return (persona_id, persona_display_name)
            except (ValueError, TypeError):
                logger.warning(f"Invalid persona_id format: {persona_id_str}")
                continue

    return None

