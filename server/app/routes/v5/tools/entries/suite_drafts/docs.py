"""Suite drafts entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.suite_drafts.get import get_suite_drafts_entries_internal
from app.routes.v5.tools.entries.suite_drafts.refresh import refresh_suite_drafts
from app.routes.v5.tools.entries.suite_drafts.search import search_suite_drafts_entries_internal


async def get_suite_drafts_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the suite drafts entry."""
    entry_table = await get_table_info(conn, "invocation_drafts_entry")
    connection_tables = [
        await get_table_info(conn, "invocation_drafts_departments_connection"),
        await get_table_info(conn, "invocation_drafts_descriptions_connection"),
        await get_table_info(conn, "invocation_drafts_flags_connection"),
        await get_table_info(conn, "invocation_drafts_keys_connection"),
        await get_table_info(conn, "invocation_drafts_names_connection"),
        await get_table_info(conn, "invocation_drafts_profiles_connection"),
        await get_table_info(conn, "invocation_drafts_reasoning_levels_connection"),
        await get_table_info(conn, "invocation_drafts_temperature_levels_connection"),
        await get_table_info(conn, "invocation_drafts_voices_connection"),
    ]

    tables = [t for t in [entry_table] + connection_tables if t is not None]

    return DocsResponse(
        name="suite_drafts",
        type="entry",
        description=(
            "Suite drafts entries (invocation_drafts_entry) represent work-in-progress suite versions. "
            "Each draft has a version number and links to departments, models, prompts, instructions, "
            "flags, names, descriptions, and other resources via connection tables. "
            "Drafts allow users to edit suites before publishing. "
            "Reads are served directly from the invocation_drafts_entry table and its connections."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                refresh_suite_drafts,
                description="Refreshes suite_drafts query caches.",
            ),
            get_operation_info(
                get_suite_drafts_entries_internal,
                description="Batch retrieves suite_drafts entries by IDs.",
            ),
            get_operation_info(
                search_suite_drafts_entries_internal,
                description="Filtered paginated search against suite_drafts entries.",
            ),
        ],
    )
