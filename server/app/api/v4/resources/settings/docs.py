"""{item.title()} resource documentation."""

from typing import Any


def get_settings_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the settings resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "settings",
        "type": "resource",
        "description": "Settings resource documentation - see SQL files for schema details",
    }
