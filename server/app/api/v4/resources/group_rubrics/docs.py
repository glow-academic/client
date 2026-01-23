"""{item.title()} resource documentation."""

from typing import Any


def get_group_rubrics_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the group_rubrics resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "group_rubrics",
        "type": "resource",
        "description": "Group_Rubrics resource documentation - see SQL files for schema details",
    }
