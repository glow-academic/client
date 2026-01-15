"""{item.title()} resource documentation."""

from typing import Any


def get_auths_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the auths resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "auths",
        "type": "resource",
        "description": "Auths resource documentation - see SQL files for schema details",
    }
