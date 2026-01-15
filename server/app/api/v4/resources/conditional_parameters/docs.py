"""{item.title()} resource documentation."""

from typing import Any


def get_conditional_parameters_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the conditional_parameters resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "conditional_parameters",
        "type": "resource",
        "description": "Conditional_Parameters resource documentation - see SQL files for schema details",
    }
