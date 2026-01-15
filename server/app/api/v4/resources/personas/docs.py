"""{item.title()} resource documentation."""

from typing import Any


def get_personas_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the personas resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "personas",
        "type": "resource",
        "description": "Personas resource documentation - see SQL files for schema details",
    }
