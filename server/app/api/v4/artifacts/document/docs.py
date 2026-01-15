"""{artifact.title()} artifact documentation."""

from typing import Any


def get_documents_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the document artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "document",
        "type": "artifact",
        "description": "Document artifact documentation - see SQL files for schema details",
    }
