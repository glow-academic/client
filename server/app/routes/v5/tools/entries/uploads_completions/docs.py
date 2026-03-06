"""Uploads completions entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.uploads_completions.create import (
    create_upload_completion,
)
from app.routes.v5.tools.entries.uploads_completions.get import get_upload_completion
from app.routes.v5.tools.entries.uploads_completions.refresh import (
    refresh_uploads_completions_internal,
)
from app.routes.v5.tools.entries.uploads_completions.search import (
    search_uploads_completions,
)


async def get_uploads_completions_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the uploads_completions entry."""
    mv_info = await get_mv_info(conn, "uploads_completions_mv")
    entry_table = await get_table_info(conn, "uploads_completions_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="uploads_completions",
        type="entry",
        description=(
            "Upload completion entries track AI-generated completions for uploads. "
            "Each row links an upload to a completion artifact within a session. "
            "Reads are served from the uploads_completions_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_upload_completion,
                description=(
                    "Creates a new uploads_completions entry linking an upload "
                    "to a completion within a session."
                ),
            ),
            get_operation_info(
                refresh_uploads_completions_internal,
                description="Refreshes uploads_completions_mv concurrently to reflect latest writes.",
            ),
            get_operation_info(
                get_upload_completion,
                description="Batch retrieves uploads_completions entries by ID from uploads_completions_mv.",
            ),
            get_operation_info(
                search_uploads_completions,
                description="Filtered paginated search against uploads_completions_mv.",
            ),
        ],
    )
