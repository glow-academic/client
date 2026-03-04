"""parameter_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_parameter(conn: asyncpg.Connection) -> None:
    """Refresh parameter_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY parameter_mv")
