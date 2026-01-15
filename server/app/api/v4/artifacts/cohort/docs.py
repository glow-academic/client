"""{artifact.title()} artifact documentation."""

from typing import Any


def get_cohorts_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the cohort artifact.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        resources, frontend information, and GLOW context.
    """
    return {
        "name": "cohort",
        "type": "artifact",
        "description": "Cohort artifact documentation - see SQL files for schema details",
    }
