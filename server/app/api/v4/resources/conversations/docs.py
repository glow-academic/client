"""{item.title()} resource documentation."""

from typing import Any


def get_conversations_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the conversations resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "conversations",
        "type": "resource",
        "description": "Conversations resource documentation - see SQL files for schema details",
    }
