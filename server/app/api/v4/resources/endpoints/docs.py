"""{item.title()} resource documentation."""

from typing import Any


def get_endpoints_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the endpoints resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "endpoints",
        "type": "resource",
        "description": "Endpoints resource documentation - see SQL files for schema details",
    }
