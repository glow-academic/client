"""{item.title()} resource documentation."""

from typing import Any


def get_slugs_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the slugs resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "slugs",
        "type": "resource",
        "description": "Slugs resource documentation - see SQL files for schema details",
    }
