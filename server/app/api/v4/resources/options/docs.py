"""{item.title()} resource documentation."""

from typing import Any


def get_options_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the options resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "options",
        "type": "resource",
        "description": "Options resource documentation - see SQL files for schema details",
    }
