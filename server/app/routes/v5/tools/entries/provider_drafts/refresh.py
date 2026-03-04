"""provider_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_provider(conn: asyncpg.Connection) -> None:
    """Refresh provider_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY provider_mv")
