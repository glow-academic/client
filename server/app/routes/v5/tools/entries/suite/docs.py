"""Suite entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.suite.get import get_suite_entries_internal
from app.routes.v5.tools.entries.suite.refresh import refresh_suite
from app.routes.v5.tools.entries.suite.search import search_suite_entries_internal


async def get_suite_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the suite entry."""
    entry_table = await get_table_info(conn, "invocation_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="suite",
        type="entry",
        description=(
            "Suite entries (invocation_entry) represent benchmark suites — "
            "top-level bundles containing groups of invocations. "
            "Each suite can use groups to organize its invocations and supports dynamic mode. "
            "Reads are served directly from the invocation_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_suite,
                description="Refreshes suite query caches.",
            ),
            get_operation_info(
                get_suite_entries_internal,
                description="Batch retrieves suite entries by IDs.",
            ),
            get_operation_info(
                search_suite_entries_internal,
                description="Filtered paginated search against suite entries.",
            ),
        ],
    )
