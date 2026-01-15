"""{item.title()} resource documentation."""

from typing import Any


def get_keys_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the keys resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "keys",
        "type": "resource",
        "description": "Keys resource documentation - see SQL files for schema details",
    }
