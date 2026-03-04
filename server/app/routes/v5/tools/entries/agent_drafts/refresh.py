"""agent_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_agent(conn: asyncpg.Connection) -> None:
    """Refresh agent_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY agent_mv")
