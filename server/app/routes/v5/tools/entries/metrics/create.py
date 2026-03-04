"""metrics/create internal — reusable data-access layer."""

from typing import cast
from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.api.entries.metrics.types import (
    CreateMetricsEntryResponse,
    CreateMetricsEntrySqlParams,
    CreateMetricsEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/entries/metrics/create_metrics_entries_complete.sql"


async def create_metrics_entry_internal(
    conn: asyncpg.Connection,
    session_id: UUID,
    ts: str,
    requests_total: int,
    errors_total: int,
    avg_latency_ms: float,
    cpu_percent: float,
    memory_bytes: int,
    mcp: bool = False,
) -> CreateMetricsEntryResponse:
    """Create a metrics entry. Internal only — no HTTP route."""
    params = CreateMetricsEntrySqlParams(
        session_id=session_id,
        ts=ts,
        requests_total=requests_total,
        errors_total=errors_total,
        avg_latency_ms=avg_latency_ms,
        cpu_percent=cpu_percent,
        memory_bytes=memory_bytes,
        mcp=mcp,
    )

    result = cast(
        CreateMetricsEntrySqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    if not result or not result.out_ts:
        raise ValueError("Failed to create metrics entry")

    return CreateMetricsEntryResponse(ts=result.out_ts)
