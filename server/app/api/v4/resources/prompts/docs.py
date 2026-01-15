"""{item.title()} resource documentation."""

from typing import Any


def get_prompts_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the prompts resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "prompts",
        "type": "resource",
        "description": "Prompts resource documentation - see SQL files for schema details",
    }
