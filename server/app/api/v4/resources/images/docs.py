"""{item.title()} resource documentation."""

from typing import Any


def get_images_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the images resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "images",
        "type": "resource",
        "description": "Images resource documentation - see SQL files for schema details",
    }
