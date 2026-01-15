"""{item.title()} resource documentation."""

from typing import Any


def get_scenario_flags_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the scenario_flags resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "scenario_flags",
        "type": "resource",
        "description": "Scenario_Flags resource documentation - see SQL files for schema details",
    }
