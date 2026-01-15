"""{item.title()} resource documentation."""

from typing import Any


def get_names_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the names resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "names",
        "type": "resource",
        "description": "Names resource documentation - see SQL files for schema details",
    }
