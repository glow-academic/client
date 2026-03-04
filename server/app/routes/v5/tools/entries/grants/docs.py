"""Grants entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.grants.create import create_grant
from app.routes.v5.tools.entries.grants.get import get_grants_entries_internal
from app.routes.v5.tools.entries.grants.search import search_grants_entries_internal


async def get_grants_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the grants entry."""
    entry_table = await get_table_info(conn, "grants_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="grants",
        type="entry",
        description=(
            "Grant entries track permission grants that expire after a specified time. "
            "Each grant is associated with a session and stores expiration information. "
            "Reads are served directly from the grants_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                create_grant,
                description="Creates a new grant entry with optional expiration time (defaults to 1 hour).",
            ),
            get_operation_info(
                get_grants_entries_internal,
                description="Batch retrieves grant entries by IDs from grants_entry.",
            ),
            get_operation_info(
                search_grants_entries_internal,
                description="Filtered paginated search against grants_entry.",
            ),
        ],
    )
