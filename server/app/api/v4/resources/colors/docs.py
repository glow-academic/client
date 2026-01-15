"""{item.title()} resource documentation."""

from typing import Any


def get_colors_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the colors resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "colors",
        "type": "resource",
        "description": "Colors resource documentation - see SQL files for schema details",
    }
