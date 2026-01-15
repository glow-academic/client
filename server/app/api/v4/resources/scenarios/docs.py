"""{item.title()} resource documentation."""

from typing import Any


def get_scenarios_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the scenarios resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "scenarios",
        "type": "resource",
        "description": "Scenarios resource documentation - see SQL files for schema details",
    }
