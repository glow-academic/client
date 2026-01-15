"""{item.title()} resource documentation."""

from typing import Any


def get_schemas_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the schemas resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "schemas",
        "type": "resource",
        "description": "Schemas resource documentation - see SQL files for schema details",
    }
