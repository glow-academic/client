"""{item.title()} resource documentation."""

from typing import Any


def get_schema_field_items_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the schema_field_items resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "schema_field_items",
        "type": "resource",
        "description": "Schema_Field_Items resource documentation - see SQL files for schema details",
    }
