"""Debug info entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.debug_info.create import create_debug_info
from app.routes.v5.tools.entries.debug_info.get import get_debug_info
from app.routes.v5.tools.entries.debug_info.refresh import refresh_debug_info
from app.routes.v5.tools.entries.debug_info.search import search_debug_info


async def get_debug_info_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the debug_info entry."""
    mv_info = await get_mv_info(conn, "debug_info_mv")
    entry_table = await get_table_info(conn, "debug_info_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="debug_info",
        type="entry",
        description=(
            "Debug info entries capture diagnostic content produced during a call. "
            "Each entry belongs to a call and optionally to a run. "
            "Reads are served from the debug_info_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_debug_info,
                description="Creates a new debug_info entry for a call.",
            ),
            get_operation_info(
                refresh_debug_info,
                description="Refreshes debug_info_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_debug_info,
                description="Batch retrieves debug_info entries by IDs from debug_info_mv.",
            ),
            get_operation_info(
                search_debug_info,
                description="Filtered paginated search against debug_info_mv.",
            ),
        ],
    )
