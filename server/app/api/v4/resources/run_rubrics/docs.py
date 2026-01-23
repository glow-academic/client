"""{item.title()} resource documentation."""

from typing import Any


def get_run_rubrics_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the run_rubrics resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "run_rubrics",
        "type": "resource",
        "description": "Run_Rubrics resource documentation - see SQL files for schema details",
    }
