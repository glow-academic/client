"""Attempt message search — filtered/paginated query against attempt_message_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.attempt_message.types import GetAttemptMessageResponse

MV_NAME = "attempt_message_mv"


async def search_attempt_messages(
    conn: asyncpg.Connection,
    chat_id: UUID | None = None,
    attempt_id: UUID | None = None,
    runs_id: UUID | None = None,
    text_id: UUID | None = None,
    audio_id: UUID | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[GetAttemptMessageResponse]:
    """Search attempt_message entries from attempt_message_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT message_id, chat_id, attempt_id, type,
               created_at, completed, runs_id, text_id,
               history_file_path, audio_id
        FROM {source}
        WHERE ($1::uuid IS NULL OR chat_id = $1)
          AND ($2::uuid IS NULL OR attempt_id = $2)
          AND ($3::uuid IS NULL OR runs_id = $3)
          AND ($4::uuid IS NULL OR text_id = $4)
          AND ($5::uuid IS NULL OR audio_id = $5)
        ORDER BY created_at DESC
        LIMIT $6 OFFSET $7
        """,
        chat_id,
        attempt_id,
        runs_id,
        text_id,
        audio_id,
        limit,
        offset,
    )

    return [GetAttemptMessageResponse(**dict(r)) for r in rows]
