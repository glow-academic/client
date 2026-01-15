"""{item.title()} resource documentation."""

from typing import Any


def get_modalities_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the modalities resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "modalities",
        "type": "resource",
        "description": "Modalities resource documentation - see SQL files for schema details",
    }
