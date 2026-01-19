"""{item.title()} resource documentation."""

from typing import Any


def get_scenario_rubrics_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the scenario_rubrics resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "scenario_rubrics",
        "type": "resource",
        "description": "Scenario_Rubrics resource documentation - see SQL files for schema details",
    }
