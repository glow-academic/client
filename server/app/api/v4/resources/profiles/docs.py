"""{item.title()} resource documentation."""

from typing import Any


def get_profiles_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the profiles resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "profiles",
        "type": "resource",
        "description": "Profiles resource documentation - see SQL files for schema details",
    }
