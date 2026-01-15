"""{item.title()} resource documentation."""

from typing import Any


def get_template_array_items_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the template_array_items resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "template_array_items",
        "type": "resource",
        "description": "Template_Array_Items resource documentation - see SQL files for schema details",
    }
