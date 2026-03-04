"""simulation_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_simulation(conn: asyncpg.Connection) -> None:
    """Refresh simulation_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY simulation_mv")
