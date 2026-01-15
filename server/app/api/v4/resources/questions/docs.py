"""{item.title()} resource documentation."""

from typing import Any


def get_questions_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the questions resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "questions",
        "type": "resource",
        "description": "Questions resource documentation - see SQL files for schema details",
    }
