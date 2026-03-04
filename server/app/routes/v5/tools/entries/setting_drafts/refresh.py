"""setting_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_setting(conn: asyncpg.Connection) -> None:
    """Refresh setting_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY setting_mv")
