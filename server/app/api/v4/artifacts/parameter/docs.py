"""{artifact.title()} artifact documentation."""

from typing import Any


def get_parameters_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the parameter artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "parameter",
        "type": "artifact",
        "description": "Parameter artifact documentation - see SQL files for schema details",
    }
