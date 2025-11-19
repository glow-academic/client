"""Staff detail endpoint - get individual staff profile details with role visibility check."""

import os
from typing import Annotated, Any

import asyncpg
from app.main import get_db
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.error.handle_route_error import handle_route_error
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

router = APIRouter()


class StaffDetailRequest(BaseModel):
    """Request for staff detail."""

    profileId: str  # Target profile to get details for
    currentProfileId: str  # Current user's profile ID for role visibility check


class StaffDetailResponse(BaseModel):
    """Response for staff detail endpoint."""

    name: str
    email: str
    role: str


@router.post("/detail", response_model=StaffDetailResponse)
async def get_staff_detail(
    request_body: StaffDetailRequest,
    request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> StaffDetailResponse:
    """Get staff profile details with role visibility check."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request_body.model_dump()
    cache_key_val = cache_key(request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return StaffDetailResponse.model_validate(cached["data"])

    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get campus email domain from environment
        campus_domain = os.getenv("NEXT_PUBLIC_CAMPUS_EMAIL", "example.edu")

        # Load SQL query
        sql_query = load_sql("sql/v3/profile/staff/get_staff_detail.sql")
        sql_params = (
            request_body.profileId,
            request_body.currentProfileId,
            campus_domain,
        )

        # Execute query
        row = await conn.fetchrow(
            sql_query, request_body.profileId, request_body.currentProfileId, campus_domain
        )

        # If no row returned, profile is not visible to current user (role hierarchy)
        if not row:
            raise HTTPException(
                status_code=404,
                detail=f"Profile {request_body.profileId} not found or not visible",
            )

        # Build response
        response_data = StaffDetailResponse(
            name=row["name"],
            email=row["email"],
            role=row["role"],
        )

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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=request.url.path,
            operation="get_staff_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=request,
        )

