"""{item.title()} resource documentation."""

from typing import Any


def get_parameters_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the parameters resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "parameters",
        "type": "resource",
        "description": "Parameters resource documentation - see SQL files for schema details",
    }
