"""Resolve profile ID from department cookies."""

import asyncpg  # type: ignore
from utils.sql_helper import load_sql


async def resolve_profile_from_department(
    department_id: str | None,
    auth_mode: str,
    conn: asyncpg.Connection,
) -> str | None:
    """Resolve profile ID from department-id + auth-mode cookies.

    Args:
        department_id: Department ID from cookie (can be None for default settings)
        auth_mode: Auth mode from cookie ("default-guest" or "default-account")
        conn: Database connection

    Returns:
        Resolved profile ID UUID string, or None if not found
    """
    if not auth_mode or auth_mode not in ("default-guest", "default-account"):
        return None

    sql = load_sql(
        "app/sql/v3/infrastructure/profile/resolve_from_department_complete.sql"
    )
    result = await conn.fetchval(sql, department_id, auth_mode)
    if result is None:
        return None
    # fetchval returns UUID object, convert to string
    return str(result)  # type: ignore[return-value]
