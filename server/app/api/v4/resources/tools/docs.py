"""{item.title()} resource documentation."""

from typing import Any


def get_tools_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the tools resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "tools",
        "type": "resource",
        "description": "Tools resource documentation - see SQL files for schema details",
    }
