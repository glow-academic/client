"""Resolve profile ID from department-id + auth-mode cookies."""

import logging

import asyncpg  # type: ignore

logger = logging.getLogger(__name__)


async def resolve_profile_from_department_cookies(
    department_id: str | None,
    auth_mode: str | None,
    db_pool: asyncpg.Pool | None,
) -> str | None:
    """Resolve profile ID from department-id + auth-mode cookies.

    Args:
        department_id: Department ID from cookie (can be None for default settings)
        auth_mode: Auth mode from cookie ("default-guest" or "default-account")
        db_pool: Database connection pool (required)

    Returns:
        Resolved profile ID UUID string, or None if not found
    """
    if not auth_mode or auth_mode not in ("default-guest", "default-account"):
        return None

    if db_pool is None:
        return None

    try:
        async with db_pool.acquire() as conn:
            from app.infra.v3.profile.resolve_from_department import (
                resolve_profile_from_department,
            )

            return await resolve_profile_from_department(department_id, auth_mode, conn)
    except Exception:
        # Log error but don't break request processing
        logger.warning(
            "Failed to resolve profile from department cookies", exc_info=True
        )
        return None
