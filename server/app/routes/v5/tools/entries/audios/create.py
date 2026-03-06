"""Audios CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.audios.types import CreateAudioResponse


async def create_audio(
    conn: asyncpg.Connection,
    session_id: UUID,
    length_seconds: int = 0,
    mcp: bool = False,
    soft: bool = False,
) -> CreateAudioResponse:
    """Create an audios entry."""
    audio_id = await conn.fetchval(
        """
        INSERT INTO audios_entry (session_id, length_seconds, active, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        RETURNING id
    """,
        session_id,
        length_seconds,
        not soft,
        mcp,
    )

    if audio_id is None:
        raise ValueError("Failed to create audios entry")

    return CreateAudioResponse(id=audio_id)
