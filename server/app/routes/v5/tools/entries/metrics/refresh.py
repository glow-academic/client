"""Metrics refresh — recompute the materialized view."""

import asyncpg  # type: ignore


async def refresh_metrics_internal(conn: asyncpg.Connection) -> None:
    """Refresh metrics_mv."""
    await conn.execute("REFRESH MATERIALIZED VIEW metrics_mv")
