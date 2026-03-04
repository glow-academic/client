"""field_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_field(conn: asyncpg.Connection) -> None:
    """Refresh field_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY field_mv")
