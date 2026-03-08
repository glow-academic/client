"""Messages search — filtered/paginated query against messages_mv."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.docs.resolve_mv_source import resolve_mv_source
from app.routes.v5.tools.entries.messages.types import SearchMessageResponse

MV_NAME = "messages_mv"


async def search_messages(
    conn: asyncpg.Connection,
    run_ids: list[UUID] | None = None,
    role: str | None = None,
    agent_ids: list[UUID] | None = None,
    limit: int = 20,
    offset: int = 0,
    bypass_mv: bool = False,
) -> list[SearchMessageResponse]:
    """Search messages from messages_mv with declarative filters."""
    source = await resolve_mv_source(conn, MV_NAME, bypass_mv)

    rows = await conn.fetch(
        f"""
        SELECT DISTINCT m.message_id, m.run_id, m.role, m.message_created_at,
               m.text_upload_ids, m.audio_upload_ids, m.image_upload_ids,
               m.video_upload_ids, m.file_upload_ids, m.call_upload_ids
        FROM {source} m
        LEFT JOIN messages_agents_connection mac ON mac.message_id = m.message_id
        WHERE ($1::uuid[] IS NULL OR m.run_id = ANY($1))
          AND ($2::text IS NULL OR m.role = $2)
          AND ($3::uuid[] IS NULL OR mac.agents_id = ANY($3))
        ORDER BY m.message_created_at DESC
        LIMIT $4 OFFSET $5
        """,
        run_ids,
        role,
        agent_ids,
        limit,
        offset,
    )

    return [SearchMessageResponse(**dict(r)) for r in rows]
