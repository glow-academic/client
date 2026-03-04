"""Test stop entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.test_stop.create import create_test_stop
from app.routes.v5.tools.entries.test_stop.get import get_test_stops
from app.routes.v5.tools.entries.test_stop.refresh import refresh_test_stop
from app.routes.v5.tools.entries.test_stop.search import search_test_stops_internal


async def get_test_stop_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the test_stop entry."""
    mv_info = await get_mv_info(conn, "test_stop_mv")
    entry_table = await get_table_info(conn, "test_stop_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="test_stop",
        type="entry",
        description=(
            "Test invocation stop signals. Records when an invocation is explicitly stopped "
            "during test execution. Tracks the stopped flag state linked to invocations. "
            "Reads are served from the test_stop_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_test_stop,
                description=(
                    "Creates a test_stop entry with invocation_id and stopped flag status."
                ),
            ),
            get_operation_info(
                refresh_test_stop,
                description="Refreshes test_stop_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_test_stops,
                description="Batch retrieves test_stop entries by IDs from test_stop_mv.",
            ),
            get_operation_info(
                search_test_stops_internal,
                description=(
                    "Filtered paginated search against test_stop entries by search text "
                    "and profile_id. Results cached for 60 seconds."
                ),
            ),
        ],
    )
