"""{item.title()} resource documentation."""

from typing import Any


def get_agents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the agents resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "agents",
        "type": "resource",
        "description": "Agents resource documentation - see SQL files for schema details",
    }
