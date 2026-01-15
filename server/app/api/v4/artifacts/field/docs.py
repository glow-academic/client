"""{artifact.title()} artifact documentation."""

from typing import Any


def get_fields_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the field artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "field",
        "type": "artifact",
        "description": "Field artifact documentation - see SQL files for schema details",
    }
