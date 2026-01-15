"""{item.title()} resource documentation."""

from typing import Any


def get_responses_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the responses resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "responses",
        "type": "resource",
        "description": "Responses resource documentation - see SQL files for schema details",
    }
