"""{item.title()} resource documentation."""

from typing import Any


def get_template_values_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the template_values resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "template_values",
        "type": "resource",
        "description": "Template_Values resource documentation - see SQL files for schema details",
    }
