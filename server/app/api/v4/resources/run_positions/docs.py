"""{item.title()} resource documentation."""

from typing import Any


def get_run_positions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the run_positions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "run_positions",
        "type": "resource",
        "description": "Run_Positions resource documentation - see SQL files for schema details",
    }
