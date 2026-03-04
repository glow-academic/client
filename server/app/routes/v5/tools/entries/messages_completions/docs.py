"""Messages completions entry documentation."""

import asyncpg  # type: ignore

from app.infra.docs.get_operation_info import get_operation_info
from app.infra.docs.get_table_info import get_table_info
from app.infra.docs.types import DocsResponse
from app.routes.v5.tools.entries.messages_completions.create import (
    create_messages_completions_entry_internal,
)
from app.routes.v5.tools.entries.messages_completions.get import (
    get_messages_completions_entries_internal,
)


async def get_messages_completions_docs(conn: asyncpg.Connection) -> DocsResponse:
    """Get full documentation for the messages_completions entry."""
    entry_table = await get_table_info(conn, "messages_completions_entry")

    tables = [t for t in [entry_table] if t is not None]

    return DocsResponse(
        name="messages_completions",
        type="entry",
        description=(
            "Messages completions entries track completion data for messages. "
            "Each completion is linked to a message and session, storing completion-related information. "
            "This is an internal-only entry with no public HTTP routes. "
            "Reads are served directly from the messages_completions_entry table."
        ),
        materialized_view=None,
        tables=tables,
        operations=[
            get_operation_info(
                create_messages_completions_entry_internal,
                description="Creates a new messages_completions entry (internal only).",
            ),
            get_operation_info(
                get_messages_completions_entries_internal,
                description="Batch retrieves messages_completions entries by IDs (internal only).",
            ),
        ],
    )
