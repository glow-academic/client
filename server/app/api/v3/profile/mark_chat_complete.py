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
    try:
        # Resolve "guest-profile-id" to actual default guest profile
        profile_id = request.profileId
        if profile_id == "guest-profile-id":
            guest_sql = load_sql("sql/v3/profile/get_default_guest_profile.sql")
            guest_row = await conn.fetchrow(guest_sql)
            if guest_row:
                profile_id = str(guest_row["id"])
            else:
                raise HTTPException(
                    status_code=404, detail="No default guest profile found in database"
                )

        # Update profile with viewed_chat = true
        update_query = """
        UPDATE profiles 
        SET viewed_chat = true, updated_at = NOW()
        WHERE id = $1
        """
        result = await conn.execute(update_query, profile_id)

        # Check if update was successful (result is the number of rows affected)
        if result == "UPDATE 0":
            raise HTTPException(status_code=404, detail="Profile not found")

        result_data = MarkTourStepResponse(
            success=True,
            message=f"Profile {profile_id} chat marked complete",
        )
        
        # Invalidate cache after mutation
        tags = ["profile"]  # From router tags
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)
        
        return result_data
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

