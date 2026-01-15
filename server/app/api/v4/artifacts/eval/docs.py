"""{artifact.title()} artifact documentation."""

from typing import Any


def get_evals_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the eval artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "eval",
        "type": "artifact",
        "description": "Eval artifact documentation - see SQL files for schema details",
    }
