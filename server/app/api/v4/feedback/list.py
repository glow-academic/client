"""Feedback list endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql

from app.infra.v4.activity.audit import audit_activity
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db


# Inline request/response schemas
class FeedbackListFilters(BaseModel):
    """Filters for feedback list request."""

    pass
    # No filters needed - returns all feedback


class FeedbackItem(BaseModel):
    """Individual feedback item in the response."""

    feedback_id: str
    type: str
    message: str
    created_at: str
    resolved: bool
    author_name: str
    author_email: str
    author_emails: list[str]
    author_profile_id: str


class FeedbackListResponse(BaseModel):
    """Response for feedback list endpoint."""

    feedback: list[FeedbackItem]


router = APIRouter()


@router.post(
    "/list",
    response_model=FeedbackListResponse,
    dependencies=[
        audit_activity("feedback.list", "{{ actor.name }} viewed feedback list")
    ],
)
async def get_feedback_list(
    filters: FeedbackListFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FeedbackListResponse:
    """Get list of all feedback entries."""
    tags = ["feedback"]  # From router tags

    # Check for cache bypass header (for hard refresh)
    bypass_cache = request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    body_dict = filters.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return FeedbackListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL query
        sql_query = load_sql("app/sql/v4/feedback/get_feedback_list.sql")
        sql_params = ()

        # Execute query
        rows = await conn.fetch(sql_query, *sql_params)

        # Transform results
        feedback_items = []
        for row in rows:
            feedback_items.append(
                FeedbackItem(
                    feedback_id=str(row["feedback_id"]),
                    type=row["type"],
                    message=row["message"],
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    resolved=row["resolved"],
                    author_name=row["author_name"],
                    author_email=row["author_email"],
                    author_emails=row["author_emails"] or [],
                    author_profile_id=row["author_profile_id"],
                )
            )

        result_data = FeedbackListResponse(feedback=feedback_items)

        # Cache response
        await set_cached(
            cache_key_val,
            {"data": result_data.model_dump()},
            ttl=300,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return result_data
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_feedback_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
