"""Internal attempt_message_tree entry create — no HTTP route."""

from uuid import UUID

import asyncpg  # type: ignore

from app.api.v4.entries.attempt_message_tree.types import (
    CreateAttemptMessageTreeEntryResponse,
    CreateAttemptMessageTreeEntrySqlParams,
    CreateAttemptMessageTreeEntrySqlRow,
)
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/attempt_message_tree/create_attempt_message_tree_entries_complete.sql"


async def create_attempt_message_tree_entry_internal(
    conn: asyncpg.Connection,
    parent_id: UUID,
    child_id: UUID,
    mcp: bool = False,
) -> CreateAttemptMessageTreeEntryResponse | None:
    """Create an attempt_message_tree entry (parent→child edge).

    Returns None if the edge already exists (ON CONFLICT DO NOTHING).
    """
    params = CreateAttemptMessageTreeEntrySqlParams(
        parent_id=parent_id,
        child_id=child_id,
        mcp=mcp,
    )

    result = await execute_sql_typed(conn, SQL_PATH, params=params)

    if not result:
        return None

    row = CreateAttemptMessageTreeEntrySqlRow.model_validate(
        result.model_dump()
        if hasattr(result, "model_dump")
        else {"id": getattr(result, "id", None)}
    )

    if not row.id:
        return None

    return CreateAttemptMessageTreeEntryResponse(id=row.id)
