"""{item.title()} resource documentation."""

from typing import Any


def get_reasoning_levels_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the reasoning_levels resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "reasoning_levels",
        "type": "resource",
        "description": "Reasoning_Levels resource documentation - see SQL files for schema details",
    }
