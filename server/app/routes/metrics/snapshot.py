"""Log app metrics snapshot to database."""

from datetime import datetime
from typing import cast

import asyncpg  # type: ignore

from app.sql.types import (
    InfrastructureMetricsSnapshotSqlParams,
    InfrastructureMetricsSnapshotSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/infrastructure/infrastructure_metrics_snapshot_complete.sql"


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
    params = InfrastructureMetricsSnapshotSqlParams(
        ts=ts.isoformat(),
        requests_total=requests_total,
        errors_total=errors_total,
        avg_latency_ms=avg_latency_ms,
        cpu_percent=cpu_percent,
        memory_bytes=memory_bytes,
    )
    cast(
        InfrastructureMetricsSnapshotSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )
