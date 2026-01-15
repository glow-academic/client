"""{item.title()} resource documentation."""

from typing import Any


def get_providers_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the providers resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "providers",
        "type": "resource",
        "description": "Providers resource documentation - see SQL files for schema details",
    }
