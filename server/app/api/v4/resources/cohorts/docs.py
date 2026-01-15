"""{item.title()} resource documentation."""

from typing import Any


def get_cohorts_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the cohorts resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "cohorts",
        "type": "resource",
        "description": "Cohorts resource documentation - see SQL files for schema details",
    }
