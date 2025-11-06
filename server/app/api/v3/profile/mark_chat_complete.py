"""Profile mark chat complete endpoint - mark viewedChat as complete."""

from typing import Annotated

import asyncpg
from app.db import get_db
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

router = APIRouter()


class MarkChatCompleteRequest(BaseModel):
    """Request to mark chat tour step as complete."""

    profileId: str


class MarkTourStepResponse(BaseModel):
    """Response from marking a tour step complete."""

    success: bool
    message: str


@router.post("/mark-chat-complete", response_model=MarkTourStepResponse)
async def mark_chat_complete(
    request: MarkChatCompleteRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MarkTourStepResponse:
    """Mark chat tour step as complete."""
    tags = ["profile"]  # From router tags
    
    try:
        # Mark chat complete with existence check in a single SQL file
        sql = load_sql("sql/v3/profile/mark_chat_complete.sql")
        result = await conn.fetchrow(sql, request.profileId)

        if not result:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile_id = result["profile_id"]
        result_data = MarkTourStepResponse(
            success=True,
            message=f"Profile {profile_id} chat marked complete",
        )
        
        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

