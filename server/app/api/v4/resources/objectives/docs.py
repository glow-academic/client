"""{item.title()} resource documentation."""

from typing import Any


def get_objectives_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the objectives resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "objectives",
        "type": "resource",
        "description": "Objectives resource documentation - see SQL files for schema details",
    }
