"""{item.title()} resource documentation."""

from typing import Any


def get_items_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the items resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "items",
        "type": "resource",
        "description": "Items resource documentation - see SQL files for schema details",
    }
