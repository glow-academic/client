"""{item.title()} resource documentation."""

from typing import Any


def get_feedbacks_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the feedbacks resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "feedbacks",
        "type": "resource",
        "description": "Feedbacks resource documentation - see SQL files for schema details",
    }
