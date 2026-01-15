"""{item.title()} resource documentation."""

from typing import Any


def get_scenario_positions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the scenario_positions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "scenario_positions",
        "type": "resource",
        "description": "Scenario_Positions resource documentation - see SQL files for schema details",
    }
