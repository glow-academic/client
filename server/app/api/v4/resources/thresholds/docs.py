"""{item.title()} resource documentation."""

from typing import Any


def get_thresholds_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the thresholds resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "thresholds",
        "type": "resource",
        "description": "Thresholds resource documentation - see SQL files for schema details",
    }
