"""{artifact.title()} artifact documentation."""

from typing import Any


def get_providers_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the provider artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "provider",
        "type": "artifact",
        "description": "Provider artifact documentation - see SQL files for schema details",
    }
