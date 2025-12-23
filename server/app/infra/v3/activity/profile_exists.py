"""Check if a profile exists in the database."""

import asyncpg  # type: ignore
from utils.sql_helper import load_sql


async def profile_exists(profile_id: str, conn: asyncpg.Connection) -> bool:
    """Check if a profile exists in the database.

    Args:
        profile_id: Profile UUID string
        conn: Database connection

    Returns:
        True if profile exists, False otherwise
    """
    sql = load_sql("app/sql/v3/infrastructure/activity/profile_exists_complete.sql")
    try:
        result = await conn.fetchval(sql, profile_id)
        return bool(result) if result is not None else False
    except (asyncpg.DataError, ValueError):
        # Invalid UUID format - profile cannot exist
        return False

