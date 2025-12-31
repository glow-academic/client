"""Log service health check to database."""

from datetime import datetime

import asyncpg  # type: ignore
from typing import cast

from app.sql.types import (
    InfraHealthMetricsSqlParams,
    InfraHealthMetricsSqlRow,
)
from utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/infrastructure/infrastructure_metrics_health_complete.sql"


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
    params = InfraHealthMetricsSqlParams(
        ts=ts,
        service=service,
        ok=ok,
        latency_ms=latency_ms,
        error=error,
    )
    cast(
        InfraHealthMetricsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
