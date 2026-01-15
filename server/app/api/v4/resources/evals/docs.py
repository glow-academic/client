"""{item.title()} resource documentation."""

from typing import Any


def get_evals_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the evals resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "evals",
        "type": "resource",
        "description": "Evals resource documentation - see SQL files for schema details",
    }
