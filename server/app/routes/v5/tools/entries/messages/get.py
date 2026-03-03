"""Messages GET — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.messages.types import GetMessageResponse


async def get_message(
    conn: asyncpg.Connection,
    message_id: UUID,
) -> GetMessageResponse | None:
    """Get a messages entry by ID."""
    row = await conn.fetchrow("""
        SELECT id, run_id, role, created_at, active, mcp, generated
        FROM messages_entry
        WHERE id = $1
    """, message_id)

    if row is None:
        return None

    return GetMessageResponse(
        id=row["id"],
        run_id=row["run_id"],
        role=str(row["role"]),
        created_at=row["created_at"],
        active=row["active"],
        mcp=row["mcp"],
        generated=row["generated"],
    )
