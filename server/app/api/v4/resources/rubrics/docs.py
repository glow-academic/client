"""{item.title()} resource documentation."""

from typing import Any


def get_rubrics_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the rubrics resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "rubrics",
        "type": "resource",
        "description": "Rubrics resource documentation - see SQL files for schema details",
    }
