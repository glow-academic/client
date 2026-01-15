"""{item.title()} resource documentation."""

from typing import Any


def get_videos_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the videos resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "videos",
        "type": "resource",
        "description": "Videos resource documentation - see SQL files for schema details",
    }
