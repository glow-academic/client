"""{item.title()} resource documentation."""

from typing import Any


def get_args_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the args resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "args",
        "type": "resource",
        "description": "Args resource documentation - see SQL files for schema details",
    }
