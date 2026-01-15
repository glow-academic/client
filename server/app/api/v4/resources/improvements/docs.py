"""{item.title()} resource documentation."""

from typing import Any


def get_improvements_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the improvements resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "improvements",
        "type": "resource",
        "description": "Improvements resource documentation - see SQL files for schema details",
    }
