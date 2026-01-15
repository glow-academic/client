"""{artifact.title()} artifact documentation."""

from typing import Any


def get_models_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the model artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "model",
        "type": "artifact",
        "description": "Model artifact documentation - see SQL files for schema details",
    }
