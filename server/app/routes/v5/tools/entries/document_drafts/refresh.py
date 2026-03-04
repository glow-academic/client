"""document_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_document(conn: asyncpg.Connection) -> None:
    """Refresh document_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY document_mv")
