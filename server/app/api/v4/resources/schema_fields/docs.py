"""{item.title()} resource documentation."""

from typing import Any


def get_schema_fields_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the schema_fields resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "schema_fields",
        "type": "resource",
        "description": "Schema_Fields resource documentation - see SQL files for schema details",
    }
