"""{item.title()} resource documentation."""

from typing import Any


def get_icons_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the icons resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "icons",
        "type": "resource",
        "description": "Icons resource documentation - see SQL files for schema details",
    }
