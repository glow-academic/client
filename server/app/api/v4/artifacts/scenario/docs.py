"""{artifact.title()} artifact documentation."""

from typing import Any


def get_scenarios_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the scenario artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "scenario",
        "type": "artifact",
        "description": "Scenario artifact documentation - see SQL files for schema details",
    }
