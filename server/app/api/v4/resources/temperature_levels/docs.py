"""{item.title()} resource documentation."""

from typing import Any


def get_temperature_levels_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the temperature_levels resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "temperature_levels",
        "type": "resource",
        "description": "Temperature_Levels resource documentation - see SQL files for schema details",
    }
