"""{item.title()} resource documentation."""

from typing import Any


def get_debug_info_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the debug_info resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "debug_info",
        "type": "resource",
        "description": "Debug_Info resource documentation - see SQL files for schema details",
    }
