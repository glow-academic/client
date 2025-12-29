"""Log service health check to database."""

from datetime import datetime

import asyncpg  # type: ignore
from utils.sql_helper import load_sql


async def log_service_health(
    ts: datetime,
    service: str,
    ok: bool,
    latency_ms: float,
    error: str,
    conn: asyncpg.Connection,
) -> None:
    """Log service health check to database.

    Args:
        ts: Timestamp (rounded to minute)
        service: Service name
        ok: Whether service is healthy
        latency_ms: Health check latency in milliseconds
        error: Error message (empty string if ok)
        conn: Database connection
    """
    sql = load_sql("app/sql/v3/infrastructure/metrics/health_complete.sql")
    await conn.execute(sql, ts, service, ok, latency_ms, error)
