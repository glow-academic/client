"""{item.title()} resource documentation."""

from typing import Any


def get_emails_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the emails resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "emails",
        "type": "resource",
        "description": "Emails resource documentation - see SQL files for schema details",
    }
