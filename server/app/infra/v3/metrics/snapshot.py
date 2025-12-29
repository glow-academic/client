"""Log app metrics snapshot to database."""

from datetime import datetime

import asyncpg  # type: ignore
from utils.sql_helper import load_sql


async def log_metrics_snapshot(
    ts: datetime,
    requests_total: int,
    errors_total: int,
    avg_latency_ms: float,
    cpu_percent: float,
    memory_bytes: int,
    conn: asyncpg.Connection,
) -> None:
    """Log app metrics snapshot to database.

    Args:
        ts: Timestamp (rounded to minute)
        requests_total: Total number of requests
        errors_total: Total number of errors
        avg_latency_ms: Average latency in milliseconds
        cpu_percent: CPU usage percentage
        memory_bytes: Memory usage in bytes
        conn: Database connection
    """
    sql = load_sql("app/sql/v3/infrastructure/metrics/snapshot_complete.sql")
    await conn.execute(
        sql,
        ts,
        requests_total,
        errors_total,
        avg_latency_ms,
        cpu_percent,
        memory_bytes,
    )
