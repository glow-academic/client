"""{artifact.title()} artifact documentation."""

from typing import Any


def get_simulations_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the simulation artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "simulation",
        "type": "artifact",
        "description": "Simulation artifact documentation - see SQL files for schema details",
    }
