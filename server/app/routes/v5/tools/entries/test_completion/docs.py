"""Test completion entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.test_completion.create import create_test_completion
from app.routes.v5.tools.entries.test_completion.get import get_test_completions
from app.routes.v5.tools.entries.test_completion.refresh import refresh_test_completion
from app.routes.v5.tools.entries.test_completion.search import (
    search_test_completions_internal,
)


async def get_test_completion_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the test_completion entry."""
    mv_info = await get_mv_info(conn, "test_completion_mv")
    entry_table = await get_table_info(conn, "test_completion_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="test_completion",
        type="entry",
        description=(
            "Test invocation completion tracking. Records when an invocation completes "
            "within a test, including the end reason (e.g., success, timeout, error). "
            "Links to test_invocation entries. "
            "Reads are served from the test_completion_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_test_completion,
                description=(
                    "Creates a test_completion entry with invocation_id, "
                    "call_id, and end_reason."
                ),
            ),
            get_operation_info(
                refresh_test_completion,
                description="Refreshes test_completion_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_test_completions,
                description="Batch retrieves test_completion entries by IDs from test_completion_mv.",
            ),
            get_operation_info(
                search_test_completions_internal,
                description=(
                    "Filtered paginated search against test_completion entries by search text "
                    "and profile_id. Results cached for 60 seconds."
                ),
            ),
        ],
    )
