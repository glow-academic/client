"""{item.title()} resource documentation."""

from typing import Any


def get_fields_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the fields resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "fields",
        "type": "resource",
        "description": "Fields resource documentation - see SQL files for schema details",
    }
