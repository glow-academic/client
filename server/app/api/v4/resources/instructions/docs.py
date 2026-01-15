"""{item.title()} resource documentation."""

from typing import Any


def get_instructions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the instructions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "instructions",
        "type": "resource",
        "description": "Instructions resource documentation - see SQL files for schema details",
    }
