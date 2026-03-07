"""Benchmark test CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.benchmark_test.types import CreateBenchmarkTestResponse


async def create_benchmark_test(
    conn: asyncpg.Connection,
    benchmark_id: UUID,
    test_id: UUID,
    session_id: UUID,
    id: UUID | None = None,
    mcp: bool = False,
    soft: bool = False,
) -> CreateBenchmarkTestResponse:
    """Create a benchmark_test_entry bridge row."""
    await conn.execute(
        """
        INSERT INTO benchmark_test_entry (id, benchmark_id, test_id, session_id, active, mcp, generated)
        VALUES (COALESCE($6, uuidv7()), $1, $2, $3, $4, $5, true)
        """,
        benchmark_id,
        test_id,
        session_id,
        not soft,
        mcp,
        id,
    )

    return CreateBenchmarkTestResponse(benchmark_id=benchmark_id, test_id=test_id)
