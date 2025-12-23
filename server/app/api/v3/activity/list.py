"""Activity list endpoint."""

from typing import Annotated, Any

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import load_sql


# Inline request/response schemas
class ActivityListFilters(BaseModel):
    """Filters for activity list request."""

    page: int = 0
    pageSize: int = 50
    search: str | None = None


class ActivityItem(BaseModel):
    """Individual activity item in the response."""

    activity_id: str
    created_at: str
    message: str
    error: bool
    profile_name: str
    profile_id: str


class ActivityListResponse(BaseModel):
    """Response for activity list endpoint."""

    data: list[ActivityItem]
    totalCount: int
    page: int
    pageSize: int
    totalPages: int


router = APIRouter()


@router.post(
    "/list",
    response_model=ActivityListResponse,
    dependencies=[
        audit_activity("activity.list", "{{ actor.name }} viewed activity list")
    ],
)
async def get_activity_list(
    filters: ActivityListFilters,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> ActivityListResponse:
    """Get paginated list of activity entries."""
    tags = ["activity"]  # From router tags

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
            return ActivityListResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Load SQL queries
        list_query = load_sql("app/sql/v3/activity/get_activity_list.sql")
        count_query = load_sql("app/sql/v3/activity/get_activity_count.sql")

        # Prepare parameters
        page = filters.page or 0
        page_size = filters.pageSize or 50
        search = filters.search or None

        sql_params = (page, page_size, search)

        # Execute queries
        rows = await conn.fetch(list_query, *sql_params)
        count_result = await conn.fetchrow(count_query, search)

        total_count = count_result["total_count"] if count_result else 0
        total_pages = (total_count + page_size - 1) // page_size if page_size > 0 else 0

        # Transform results
        activity_items = []
        for row in rows:
            activity_items.append(
                ActivityItem(
                    activity_id=str(row["activity_id"]),
                    created_at=row["created_at"].isoformat()
                    if row["created_at"]
                    else "",
                    message=row["message"],
                    error=row["error"],
                    profile_name=row["profile_name"],
                    profile_id=row["profile_id"],
                )
            )

        result_data = ActivityListResponse(
            data=activity_items,
            totalCount=total_count,
            page=page,
            pageSize=page_size,
            totalPages=total_pages,
        )

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
            operation="get_activity_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )
