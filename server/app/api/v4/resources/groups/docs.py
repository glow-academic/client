"""{item.title()} resource documentation."""

from typing import Any


def get_groups_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the groups resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "groups",
        "type": "resource",
        "description": "Groups resource documentation - see SQL files for schema details",
    }
