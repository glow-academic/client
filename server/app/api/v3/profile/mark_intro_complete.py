"""Profile mark intro complete endpoint - mark viewedIntro as complete."""

from typing import Annotated, Any

import asyncpg
from app.main import get_db, transaction
from app.utils.error_handler import handle_route_error
from app.utils.http_cache import invalidate_tags
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class MarkIntroCompleteRequest(BaseModel):
    """Request to mark intro tour step as complete."""

    profileId: str


class MarkTourStepResponse(BaseModel):
    """Response from marking a tour step complete."""

    success: bool
    message: str


@router.post("/mark-intro-complete", response_model=MarkTourStepResponse)
async def mark_intro_complete(
    request: MarkIntroCompleteRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> MarkTourStepResponse:
    """Mark intro tour step as complete."""
    tags = ["profile"]  # From router tags

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Mark intro complete with existence check in a single SQL file
        sql_query = load_sql("sql/v3/profile/mark_intro_complete.sql")
        sql_params = (request.profileId,)
        result = await conn.fetchrow(sql_query, request.profileId)

        if not result:
            raise HTTPException(status_code=404, detail="Profile not found")

        profile_id = result["profile_id"]
        result_data = MarkTourStepResponse(
            success=True,
            message=f"Profile {profile_id} intro marked complete",
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="mark_intro_complete",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
