"""{item.title()} resource documentation."""

from typing import Any


def get_request_limits_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the request_limits resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "request_limits",
        "type": "resource",
        "description": "Request_Limits resource documentation - see SQL files for schema details",
    }
