"""{item.title()} resource documentation."""

from typing import Any


def get_analyses_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the analyses resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "analyses",
        "type": "resource",
        "description": "Analyses resource documentation - see SQL files for schema details",
    }
