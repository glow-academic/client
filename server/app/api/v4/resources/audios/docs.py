"""{item.title()} resource documentation."""

from typing import Any


def get_audios_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the audios resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "audios",
        "type": "resource",
        "description": "Audios resource documentation - see SQL files for schema details",
    }
