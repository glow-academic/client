"""{item.title()} resource documentation."""

from typing import Any


def get_hints_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the hints resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "hints",
        "type": "resource",
        "description": "Hints resource documentation - see SQL files for schema details",
    }
