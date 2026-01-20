"""Resolve profile ID from department cookies."""

import asyncpg  # type: ignore


async def resolve_profile_from_department(
    department_id: str | None,
    auth_mode: str,
    conn: asyncpg.Connection,
) -> str | None:
    """Resolve profile ID from department-id + auth-mode cookies.

    Args:
        department_id: Department ID from cookie (can be None for default settings)
        auth_mode: Auth mode from cookie (unused)
        conn: Database connection

    Returns:
        Resolved profile ID UUID string, or None if not found
    """
    return None
