"""{item.title()} resource documentation."""

from typing import Any


def get_simulation_scenario_flags_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the simulation_scenario_flags resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "simulation_scenario_flags",
        "type": "resource",
        "description": "Simulation_Scenario_Flags resource documentation - see SQL files for schema details",
    }
