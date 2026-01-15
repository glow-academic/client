"""{item.title()} resource documentation."""

from typing import Any


def get_contents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the contents resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "contents",
        "type": "resource",
        "description": "Contents resource documentation - see SQL files for schema details",
    }
