"""{item.title()} resource documentation."""

from typing import Any


def get_voices_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the voices resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "voices",
        "type": "resource",
        "description": "Voices resource documentation - see SQL files for schema details",
    }
