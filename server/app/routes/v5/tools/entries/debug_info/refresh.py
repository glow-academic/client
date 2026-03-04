"""Debug info refresh — recompute the materialized view."""

import asyncpg  # type: ignore


async def refresh_debug_info(conn: asyncpg.Connection) -> None:
    """Refresh debug_info_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY debug_info_mv")
