"""{item.title()} resource documentation."""

from typing import Any


def get_values_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the values resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "values",
        "type": "resource",
        "description": "Values resource documentation - see SQL files for schema details",
    }
