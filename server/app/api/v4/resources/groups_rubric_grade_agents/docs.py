"""{item.title()} resource documentation."""

from typing import Any


def get_groups_rubric_grade_agents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the groups_rubric_grade_agents resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "groups_rubric_grade_agents",
        "type": "resource",
        "description": "Groups_Rubric_Grade_Agents resource documentation - see SQL files for schema details",
    }
