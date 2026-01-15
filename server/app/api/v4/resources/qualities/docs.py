"""{item.title()} resource documentation."""

from typing import Any


def get_qualities_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the qualities resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "qualities",
        "type": "resource",
        "description": "Qualities resource documentation - see SQL files for schema details",
    }
