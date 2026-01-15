"""{item.title()} resource documentation."""

from typing import Any


def get_points_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the points resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "points",
        "type": "resource",
        "description": "Points resource documentation - see SQL files for schema details",
    }
