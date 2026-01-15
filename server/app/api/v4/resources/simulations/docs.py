"""{item.title()} resource documentation."""

from typing import Any


def get_simulations_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the simulations resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "simulations",
        "type": "resource",
        "description": "Simulations resource documentation - see SQL files for schema details",
    }
