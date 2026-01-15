"""{item.title()} resource documentation."""

from typing import Any


def get_group_positions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the group_positions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "group_positions",
        "type": "resource",
        "description": "Group_Positions resource documentation - see SQL files for schema details",
    }
