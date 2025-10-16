"""Assistant v2 API endpoints."""

from typing import Annotated, Any, Dict
from uuid import UUID

import asyncpg  # type: ignore
from app.db import get_db
from app.queries.assistant_queries import get_assistant_chat_full_data
from fastapi import APIRouter, Depends, HTTPException, Query

router = APIRouter(prefix="/assistant", tags=["assistant"])


@router.get("/chats/{chat_id}/full")
async def get_assistant_chat_full(
    chat_id: UUID,
    profile_id: Annotated[UUID, Query()],
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Dict[str, Any]:
    """Get complete assistant chat data with all related entities."""
    try:
        return await get_assistant_chat_full_data(conn, chat_id, profile_id)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/chats/list/{profile_id}")
async def get_assistant_chats_list(
    profile_id: UUID,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Dict[str, Any]:
    """Get all chats for a profile (for new chat state without chat_id)."""
    try:
        # Pass None as chat_id to only fetch the chats list
        return await get_assistant_chat_full_data(conn, None, profile_id)  # type: ignore
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

