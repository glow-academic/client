"""invocation_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_invocation(conn: asyncpg.Connection) -> None:
    """Refresh invocation_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY invocation_mv")
