"""{artifact.title()} artifact documentation."""

from typing import Any


def get_agents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the agent artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "agent",
        "type": "artifact",
        "description": "Agent artifact documentation - see SQL files for schema details",
    }
