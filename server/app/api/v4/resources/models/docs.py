"""{item.title()} resource documentation."""

from typing import Any


def get_models_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the models resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "models",
        "type": "resource",
        "description": "Models resource documentation - see SQL files for schema details",
    }
