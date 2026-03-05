"""Entries resource documentation."""

import asyncpg

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.resources.entries.create import create_entry
from app.routes.v5.tools.resources.entries.get import get_entries
from app.routes.v5.tools.resources.entries.search import search_entries


async def get_entries_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the entries resource."""
    resource_table = await get_table_info(conn, "entries_resource")
    tables = [t for t in [resource_table] if t is not None]

    return DocsResponse(
        name="entries",
        type="resource",
        description="Entry type references used by tools.",
        tables=tables,
        operations=[
            get_operation_info(
                create_entry,
                description="Creates a new entries resource.",
            ),
            get_operation_info(
                get_entries,
                description="Batch retrieves entries by IDs.",
            ),
            get_operation_info(
                search_entries,
                description="Filtered paginated search returning matching entries.",
            ),
        ],
    )
