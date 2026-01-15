"""{item.title()} resource documentation."""

from typing import Any


def get_documents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the documents resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "documents",
        "type": "resource",
        "description": "Documents resource documentation - see SQL files for schema details",
    }
