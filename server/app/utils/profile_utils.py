"""Profile utilities for v3 API.

Extracted from app.queries.profile_queries to remove v2 dependencies.
"""

from typing import Any


def get_default_guest_profile_query() -> tuple[str, list[Any]]:
    """Build query to get default guest profile."""
    query = """
    SELECT id
    FROM profiles
    WHERE role = 'guest' AND default_profile = true
    LIMIT 1
    """
    return (query, [])

