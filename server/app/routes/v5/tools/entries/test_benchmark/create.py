"""Test benchmark bridge CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.test_benchmark.types import (
    CreateTestBenchmarkResponse,
)


async def create_test_benchmark(
    conn: asyncpg.Connection,
    test_id: UUID,
    benchmark_id: UUID,
    session_id: UUID | None = None,
    mcp: bool = False,
) -> CreateTestBenchmarkResponse:
    """Create a test_benchmark_entry bridge row."""
    await conn.execute(
        """
        INSERT INTO test_benchmark_entry (test_id, benchmark_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        """,
        test_id,
        benchmark_id,
        session_id,
        mcp,
    )

    return CreateTestBenchmarkResponse(test_id=test_id, benchmark_id=benchmark_id)
