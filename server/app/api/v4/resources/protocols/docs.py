"""{item.title()} resource documentation."""

from typing import Any


def get_protocols_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the protocols resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "protocols",
        "type": "resource",
        "description": "Protocols resource documentation - see SQL files for schema details",
    }
