"""{artifact.title()} artifact documentation."""

from typing import Any


def get_rubrics_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the rubric artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "rubric",
        "type": "artifact",
        "description": "Rubric artifact documentation - see SQL files for schema details",
    }
