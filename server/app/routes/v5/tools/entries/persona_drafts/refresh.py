"""persona_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_persona(conn: asyncpg.Connection) -> None:
    """Refresh persona_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY persona_mv")
