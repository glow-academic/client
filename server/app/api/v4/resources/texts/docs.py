"""{item.title()} resource documentation."""

from typing import Any


def get_texts_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the texts resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "texts",
        "type": "resource",
        "description": "Texts resource documentation - see SQL files for schema details",
    }
