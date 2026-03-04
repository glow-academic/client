"""Mutes entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.mutes.create import create_mute
from app.routes.v5.tools.entries.mutes.get import get_mutes
from app.routes.v5.tools.entries.mutes.refresh import refresh_mutes
from app.routes.v5.tools.entries.mutes.search import search_mutes


async def get_mutes_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the mutes entry."""
    mv_info = await get_mv_info(conn, "mutes_mv")
    entry_table = await get_table_info(conn, "mutes_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="mutes",
        type="entry",
        description=(
            "Mute entries record whether a conversation is muted. "
            "Each entry belongs to a conversation and tracks the muted state. "
            "Reads are served from the mutes_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_mute,
                description="Creates a new mutes entry for a conversation.",
            ),
            get_operation_info(
                refresh_mutes,
                description="Refreshes mutes_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_mutes,
                description="Batch retrieves mute entries by IDs from mutes_mv.",
            ),
            get_operation_info(
                search_mutes,
                description="Filtered paginated search against mutes_mv.",
            ),
        ],
    )
