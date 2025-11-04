"""Feedback list endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.db import get_db
from app.utils.http_cache import cache_key, get_cached, set_cached
from app.utils.sql_helper import load_sql

# Inline request/response schemas
class FeedbackListRequest(BaseModel):
    profileId: str


class FeedbackItem(BaseModel):
    feedback_id: int
    type: str
    message: str
    created_at: str
    author_name: str
    author_alias: str
    author_profile_id: str


class FeedbackListResponse(BaseModel):
    feedback: list[FeedbackItem]


router = APIRouter()


@router.post("/list", response_model=FeedbackListResponse)
async def list_feedback(
    request: FeedbackListRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FeedbackListResponse:
    """Get list of feedback with author information."""
    tags = ["feedback"]  # From router tags
    
    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)
    
    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return FeedbackListResponse.model_validate(cached["data"])
    
    try:
        sql = load_sql("sql/v3/feedback/get_feedback_list.sql")
        rows = await conn.fetch(sql)

        feedback_items: list[FeedbackItem] = []
        for row in rows:
            feedback_items.append(
                FeedbackItem(
                    feedback_id=row["feedback_id"],
                    type=row["type"],
                    message=row["message"],
                    created_at=row["created_at"].isoformat() if row["created_at"] else "",
                    author_name=row["author_name"],
                    author_alias=row["author_alias"],
                    author_profile_id=row["author_profile_id"],
                )
            )

        response_data = FeedbackListResponse(feedback=feedback_items)
        
        # Cache response
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump()},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"
        
        return response_data
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

