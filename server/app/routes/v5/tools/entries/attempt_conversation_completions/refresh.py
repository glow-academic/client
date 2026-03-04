"""Entry refresh — reusable data-access layer."""

import asyncpg

MV_NAME = "attempt_conversation_completions_mv"


async def refresh_attempt_conversation_completions(conn: asyncpg.Connection) -> None:
    """Refresh attempt_conversation_completions_mv concurrently."""
    await conn.execute(f"REFRESH MATERIALIZED VIEW CONCURRENTLY {MV_NAME}")
