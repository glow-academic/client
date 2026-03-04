"""Benchmark refresh — reusable data-access layer."""

import asyncpg

MV_NAME = "benchmark_mv"


async def refresh_benchmark(conn: asyncpg.Connection) -> None:
    """Refresh benchmark_mv."""
    await conn.execute(f"REFRESH MATERIALIZED VIEW {MV_NAME}")
