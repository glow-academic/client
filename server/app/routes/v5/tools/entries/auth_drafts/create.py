"""auth_drafts CREATE — thin wrapper around shared drafts CRUD."""

from uuid import UUID

import asyncpg  # type: ignore

from app.infra.drafts.crud import create_draft
from app.infra.drafts.types import CreateDraftResponse

TABLE = "auth_drafts_entry"


async def create_auth_drafts(
    conn: asyncpg.Connection,
    group_id: UUID,
    session_id: UUID,
    version: int = 0,
    mcp: bool = False,
) -> CreateDraftResponse:
    """Create a auth_drafts entry."""
    return await create_draft(
        conn, TABLE, group_id=group_id, session_id=session_id, version=version, mcp=mcp
    )
