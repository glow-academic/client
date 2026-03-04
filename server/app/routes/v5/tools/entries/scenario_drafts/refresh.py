"""scenario_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_scenario(conn: asyncpg.Connection) -> None:
    """Refresh scenario_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY scenario_mv")
