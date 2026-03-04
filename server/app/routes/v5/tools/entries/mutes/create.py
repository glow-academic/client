"""Mutes CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.mutes.types import CreateMuteResponse


async def create_mute(
    conn: asyncpg.Connection,
    conversation_id: UUID,
    muted: bool = True,
    call_id: UUID | None = None,
    mcp: bool = False,
) -> CreateMuteResponse:
    """Create a mutes entry."""
    mute_id = await conn.fetchval(
        """
        INSERT INTO mutes_entry (conversation_id, muted, call_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
        """,
        conversation_id,
        muted,
        call_id,
        mcp,
    )

    if mute_id is None:
        raise ValueError("Failed to create mutes entry")

    return CreateMuteResponse(id=mute_id)
