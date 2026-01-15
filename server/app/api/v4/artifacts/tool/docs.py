"""{artifact.title()} artifact documentation."""

from typing import Any


def get_tools_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the tool artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "tool",
        "type": "artifact",
        "description": "Tool artifact documentation - see SQL files for schema details",
    }
