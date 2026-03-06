"""Attempt completion entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.attempt_completion.create import (
    create_attempt_completion,
)
from app.routes.v5.tools.entries.attempt_completion.get import get_attempt_completions
from app.routes.v5.tools.entries.attempt_completion.refresh import (
    refresh_attempt_completion,
)
from app.routes.v5.tools.entries.attempt_completion.search import (
    search_attempt_completions,
)


async def get_attempt_completion_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the attempt_completion entry."""
    mv_info = await get_mv_info(conn, "attempt_completion_mv")
    entry_table = await get_table_info(conn, "attempt_completion_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="attempt_completion",
        type="entry",
        description=(
            "Chat completion records tracking when a chat ends, including the end reason. "
            "Each completion references a chat and is generated from a call. "
            "Reads are served from the attempt_completion_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_attempt_completion,
                description="Creates a new attempt_completion entry for a chat.",
            ),
            get_operation_info(
                refresh_attempt_completion,
                description="Refreshes attempt_completion_mv concurrently.",
            ),
            get_operation_info(
                get_attempt_completions,
                description="Batch retrieves completions by IDs from attempt_completion_mv.",
            ),
            get_operation_info(
                search_attempt_completions,
                description="Filtered paginated search against attempt_completion_mv.",
            ),
        ],
    )
