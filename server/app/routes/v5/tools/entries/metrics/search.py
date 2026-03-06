"""Metrics search — filtered/paginated query against metrics_mv."""

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.metrics.types import GetMetricsSearchResponse

MV_NAME = "metrics_mv"


async def search_metrics(
    conn: asyncpg.Connection,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetMetricsSearchResponse]:
    """Search metrics from metrics_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT date_hour, sample_count,
               avg_cpu_percent, min_cpu_percent, max_cpu_percent,
               avg_latency_ms, min_latency_ms, max_latency_ms,
               avg_memory_bytes, min_memory_bytes, max_memory_bytes,
               max_requests_total, max_errors_total
        FROM {source}
        ORDER BY date_hour DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )

    return [GetMetricsSearchResponse(**dict(r)) for r in rows]
