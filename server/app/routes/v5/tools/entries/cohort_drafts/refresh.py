"""cohort_drafts refresh — recompute the materialized view."""

import asyncpg


async def refresh_cohort(conn: asyncpg.Connection) -> None:
    """Refresh cohort_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY cohort_mv")
