"""eval_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_eval(conn: asyncpg.Connection) -> None:
    """Refresh eval_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY eval_mv")
