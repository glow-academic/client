"""{item.title()} resource documentation."""

from typing import Any


def get_simulation_positions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the simulation_positions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "simulation_positions",
        "type": "resource",
        "description": "Simulation_Positions resource documentation - see SQL files for schema details",
    }
