"""{artifact.title()} artifact documentation."""

from typing import Any


def get_settings_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the setting artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "setting",
        "type": "artifact",
        "description": "Setting artifact documentation - see SQL files for schema details",
    }
