"""{item.title()} resource documentation."""

from typing import Any


def get_templates_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the templates resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "templates",
        "type": "resource",
        "description": "Templates resource documentation - see SQL files for schema details",
    }
