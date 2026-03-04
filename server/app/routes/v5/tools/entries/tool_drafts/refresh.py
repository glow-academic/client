"""tool_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_tool(conn: asyncpg.Connection) -> None:
    """Refresh tool_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY tool_mv")
