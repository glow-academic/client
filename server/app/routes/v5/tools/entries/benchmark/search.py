"""Benchmark search — filtered/paginated query against benchmark_mv."""

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.benchmark.types import GetBenchmarkResponse

MV_NAME = "benchmark_mv"


async def search_benchmarks(
    conn: asyncpg.Connection,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetBenchmarkResponse]:
    """Search benchmarks from benchmark_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT benchmark_id, use_groups, dynamic, eval_ids, profile_ids,
               department_ids, invocation_entry_ids, created_at, updated_at, active
        FROM {source}
        ORDER BY created_at DESC
        LIMIT $1 OFFSET $2
        """,
        limit,
        offset,
    )

    return [GetBenchmarkResponse(**dict(r)) for r in rows]
