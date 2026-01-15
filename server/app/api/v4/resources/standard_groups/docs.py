"""{item.title()} resource documentation."""

from typing import Any


def get_standard_groups_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the standard_groups resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "standard_groups",
        "type": "resource",
        "description": "Standard_Groups resource documentation - see SQL files for schema details",
    }
