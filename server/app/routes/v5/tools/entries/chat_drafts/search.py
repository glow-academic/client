"""chat_drafts search — thin wrapper around shared drafts CRUD."""

from datetime import datetime
from uuid import UUID

import asyncpg  # type: ignore

from app.infra.drafts.crud import search_drafts
from app.infra.drafts.types import GetDraftResponse

TABLE = "chat_drafts_entry"


async def search_chat_drafts(
    conn: asyncpg.Connection,
    group_id: UUID | None = None,
    session_id: UUID | None = None,
    date_from: datetime | None = None,
    date_to: datetime | None = None,
    mcp: bool | None = None,
    limit: int = 20,
    offset: int = 0,
) -> list[GetDraftResponse]:
    """Search chat_drafts with declarative filters."""
    return await search_drafts(
        conn,
        TABLE,
        group_id=group_id,
        session_id=session_id,
        date_from=date_from,
        date_to=date_to,
        mcp=mcp,
        limit=limit,
        offset=offset,
    )
