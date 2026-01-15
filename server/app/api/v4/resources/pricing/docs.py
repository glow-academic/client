"""{item.title()} resource documentation."""

from typing import Any


def get_pricing_docs() -> dict[str, Any]:
    """Get comprehensive documentation for the pricing resource.

    Returns:
        Dictionary containing database schema, relationships, API routing,
        and GLOW context.
    """
    return {
        "name": "pricing",
        "type": "resource",
        "description": "Pricing resource documentation - see SQL files for schema details",
    }
