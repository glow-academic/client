"""{artifact.title()} artifact documentation."""

from typing import Any


def get_profiles_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the profile artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "profile",
        "type": "artifact",
        "description": "Profile artifact documentation - see SQL files for schema details",
    }
