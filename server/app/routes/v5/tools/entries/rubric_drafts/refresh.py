"""rubric_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_rubric(conn: asyncpg.Connection) -> None:
    """Refresh rubric_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY rubric_mv")
