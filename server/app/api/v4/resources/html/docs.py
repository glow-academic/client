"""{item.title()} resource documentation."""

from typing import Any


def get_html_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the html resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "html",
        "type": "resource",
        "description": "Html resource documentation - see SQL files for schema details",
    }
