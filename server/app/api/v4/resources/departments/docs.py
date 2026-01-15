"""{item.title()} resource documentation."""

from typing import Any


def get_departments_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the departments resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "departments",
        "type": "resource",
        "description": "Departments resource documentation - see SQL files for schema details",
    }
