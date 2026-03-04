"""Reports entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.reports.create import create_reports_entry_internal
from app.routes.v5.tools.entries.reports.get import get_reports_entries_internal
from app.routes.v5.tools.entries.reports.search import search_reports_entries_internal


async def get_reports_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the reports entry."""
    entry_table = await get_table_info(conn, "reports_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="reports",
        type="entry",
        description=(
            "Reports entries capture generated reports from runs and other operations. "
            "Each report is associated with a run, tool, and text upload containing the report content. "
            "This is a write-heavy append-only table — reports are not typically mutated. "
            "Reads are served directly from the reports_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                create_reports_entry_internal,
                description=(
                    "Creates a new reports entry with run, tool, and text upload references. "
                    "Tool is resolved from settings if not provided."
                ),
            ),
            get_operation_info(
                get_reports_entries_internal,
                description="Batch retrieves reports entries by IDs.",
            ),
            get_operation_info(
                search_reports_entries_internal,
                description="Filtered paginated search against reports_entry.",
            ),
        ],
    )
