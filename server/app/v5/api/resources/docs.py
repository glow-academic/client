"""Resources root documentation."""

from typing import Any


def get_resources_docs() -> dict[str, Any]:
    """Get comprehensive documentation for resources.

    Returns:
        Dictionary containing resource information and GLOW context.
    """
    return {
        "name": "resources",
        "type": "resource_collection",
        "description": "Resources are sub-entities or attributes that belong to artifacts",
    }
