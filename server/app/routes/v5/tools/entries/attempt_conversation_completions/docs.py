"""Attempt conversation completions entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_mv_info import get_mv_info
from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.attempt_conversation_completions.create import (
    create_attempt_conversation_completions,
)
from app.routes.v5.tools.entries.attempt_conversation_completions.get import (
    get_attempt_conversation_completions,
)
from app.routes.v5.tools.entries.attempt_conversation_completions.refresh import (
    refresh_attempt_conversation_completions,
)
from app.routes.v5.tools.entries.attempt_conversation_completions.search import (
    search_attempt_conversation_completions,
)


async def get_attempt_conversation_completions_docs(
    conn: asyncpg.Connection,
) -> DocsResponse:
    """Get full documentation for the attempt_conversation_completions entry."""
    mv_info = await get_mv_info(conn, "attempt_conversation_completions_mv")
    entry_table = await get_table_info(conn, "attempt_conversation_completions_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="attempt_conversation_completions",
        type="entry",
        description=(
            "Conversation completion records tracking when a conversation ends "
            "with the end reason. Each completion references a conversation. "
            "Reads are served from the attempt_conversation_completions_mv materialized view."
        ),
        materialized_view=mv_info,
        tables=tables,
        operations=[
            get_operation_info(
                create_attempt_conversation_completions,
                description="Creates a new attempt_conversation_completions entry.",
            ),
            get_operation_info(
                refresh_attempt_conversation_completions,
                description="Refreshes attempt_conversation_completions_mv concurrently.",
            ),
            get_operation_info(
                get_attempt_conversation_completions,
                description="Batch retrieves completions by IDs from the materialized view.",
            ),
            get_operation_info(
                search_attempt_conversation_completions,
                description="Filtered paginated search against attempt_conversation_completions_mv.",
            ),
        ],
    )
