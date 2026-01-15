"""{item.title()} resource documentation."""

from typing import Any


def get_strengths_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the strengths resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "strengths",
        "type": "resource",
        "description": "Strengths resource documentation - see SQL files for schema details",
    }
