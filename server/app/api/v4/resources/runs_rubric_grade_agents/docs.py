"""{item.title()} resource documentation."""

from typing import Any


def get_runs_rubric_grade_agents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the runs_rubric_grade_agents resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "runs_rubric_grade_agents",
        "type": "resource",
        "description": "Runs_Rubric_Grade_Agents resource documentation - see SQL files for schema details",
    }
