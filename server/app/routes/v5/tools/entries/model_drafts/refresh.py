"""model_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_model(conn: asyncpg.Connection) -> None:
    """Refresh model_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY model_mv")
