"""Test benchmark bridge entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.test_benchmark.create import create_test_benchmark
from app.routes.v5.tools.entries.test_benchmark.refresh import refresh_test_benchmark


async def get_test_benchmark_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the test_benchmark entry."""
    mv_info = await get_mv_info(conn, "test_benchmark_mv")
    entry_table = await get_table_info(conn, "test_benchmark_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="test_benchmark",
        type="entry",
        description=(
            "Test benchmark bridge entries link tests to benchmarks via a session. "
            "This bridge table connects the test and benchmark domains. "
            "Reads are served from the test_benchmark_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_test_benchmark,
                description=(
                    "Creates a new test_benchmark entry linking a test "
                    "to a benchmark within a session."
                ),
            ),
            get_operation_info(
                refresh_test_benchmark,
                description="Refreshes test_benchmark_mv concurrently to reflect latest writes.",
            ),
        ],
    )
