"""{item.title()} resource documentation."""

from typing import Any


def get_flags_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the flags resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "flags",
        "type": "resource",
        "description": "Flags resource documentation - see SQL files for schema details",
    }
