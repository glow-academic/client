"""Resolve profile ID from department-id + auth-mode cookies."""

import asyncpg  # type: ignore


async def resolve_profile_from_department_cookies(
    department_id: str | None,
    auth_mode: str | None,
    db_pool: asyncpg.Pool | None,
) -> str | None:
    """Resolve profile ID from department-id + auth-mode cookies.

    Args:
        department_id: Department ID from cookie (can be None for default settings)
        auth_mode: Auth mode from cookie (unused)
        db_pool: Database connection pool (required)

    Returns:
        Resolved profile ID UUID string, or None if not found
    """
    return None
