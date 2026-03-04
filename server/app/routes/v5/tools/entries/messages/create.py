"""Messages CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.messages.types import CreateMessageResponse


async def create_message(
    conn: asyncpg.Connection,
    run_id: UUID,
    role: str,
    mcp: bool = False,
) -> CreateMessageResponse:
    """Create a messages entry."""
    row = await conn.fetchrow(
        """
        INSERT INTO messages_entry (run_id, role, mcp, generated)
        VALUES ($1, $2::message_type, $3, true)
        RETURNING id, created_at
    """,
        run_id,
        role,
        mcp,
    )

    if row is None:
        raise ValueError("Failed to create messages entry")

    return CreateMessageResponse(id=row["id"], created_at=row["created_at"])
