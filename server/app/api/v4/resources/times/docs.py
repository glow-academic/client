"""{item.title()} resource documentation."""

from typing import Any


def get_times_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the times resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "times",
        "type": "resource",
        "description": "Times resource documentation - see SQL files for schema details",
    }
