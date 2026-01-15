"""{item.title()} resource documentation."""

from typing import Any


def get_problem_statements_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the problem_statements resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "problem_statements",
        "type": "resource",
        "description": "Problem_Statements resource documentation - see SQL files for schema details",
    }
