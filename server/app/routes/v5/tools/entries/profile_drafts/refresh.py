"""profile_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_profile(conn: asyncpg.Connection) -> None:
    """Refresh profile_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY profile_mv")
