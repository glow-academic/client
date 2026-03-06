"""Messages completions refresh — recompute the materialized view."""

import asyncpg  # type: ignore


async def refresh_messages_completions_internal(conn: asyncpg.Connection) -> None:
    """Refresh messages_completions_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY messages_completions_mv")
