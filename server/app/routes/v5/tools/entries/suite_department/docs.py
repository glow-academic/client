"""Suite department entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.suite_department.get import (
    get_suite_department_entries_internal,
)
from app.routes.v5.tools.entries.suite_department.refresh import refresh_suite_department
from app.routes.v5.tools.entries.suite_department.search import (
    search_suite_department_entries_internal,
)


async def get_suite_department_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the suite department entry."""
    entry_table = await get_table_info(conn, "invocation_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="suite_department",
        type="entry",
        description=(
            "Suite department entries provide a department-filtered view of suite entries. "
            "These entries filter suites by user department access, enabling scoped suite discovery. "
            "Reads are served directly from filtered invocation_entry records."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_suite_department,
                description="Refreshes suite_department query caches.",
            ),
            get_operation_info(
                get_suite_department_entries_internal,
                description="Batch retrieves suite_department entries by IDs.",
            ),
            get_operation_info(
                search_suite_department_entries_internal,
                description="Filtered paginated search against suite_department entries.",
            ),
        ],
    )
