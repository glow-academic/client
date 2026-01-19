"""{item.title()} resource documentation."""

from typing import Any


def get_standards_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the standards resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "standards",
        "type": "resource",
        "description": "Standards resource documentation - see SQL files for schema details",
    }
