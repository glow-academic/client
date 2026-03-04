"""Test benchmark refresh — recompute the materialized view."""

import asyncpg


async def refresh_test_benchmark(conn: asyncpg.Connection) -> None:
    """Refresh test_benchmark_mv concurrently."""
    await conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY test_benchmark_mv")
