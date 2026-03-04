"""Attempt chat bridge CREATE — reusable data-access layer."""

from uuid import UUID

import asyncpg  # type: ignore

from app.routes.v5.tools.entries.attempt_chat_bridge.types import (
    CreateAttemptChatBridgeResponse,
)


async def create_attempt_chat_bridge(
    conn: asyncpg.Connection,
    attempt_id: UUID,
    attempt_chat_id: UUID,
    session_id: UUID,
    mcp: bool = False,
) -> CreateAttemptChatBridgeResponse:
    """Create an attempt_chat_bridge_entry row."""
    await conn.execute(
        """
        INSERT INTO attempt_chat_bridge_entry (attempt_id, attempt_chat_id, session_id, mcp, generated)
        VALUES ($1, $2, $3, $4, true)
        """,
        attempt_id,
        attempt_chat_id,
        session_id,
        mcp,
    )

    return CreateAttemptChatBridgeResponse(
        attempt_id=attempt_id, attempt_chat_id=attempt_chat_id
    )
