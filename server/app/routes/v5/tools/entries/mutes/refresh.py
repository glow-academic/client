"""Mutes refresh — recompute the materialized view."""

import asyncpg  # type: ignore


async def refresh_mutes(conn: asyncpg.Connection) -> None:
    """Refresh mutes_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mutes_mv")
