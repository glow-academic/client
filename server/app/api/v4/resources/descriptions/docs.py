"""{item.title()} resource documentation."""

from typing import Any


def get_descriptions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the descriptions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "descriptions",
        "type": "resource",
        "description": "Descriptions resource documentation - see SQL files for schema details",
    }
