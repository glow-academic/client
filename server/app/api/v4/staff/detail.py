"""Staff detail endpoint - get individual staff profile details with role visibility check."""

import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetStaffDetailApiRequest,
    GetStaffDetailApiResponse,
    GetStaffDetailSqlParams,
    GetStaffDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/staff/get_staff_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetStaffDetailApiResponse,
    dependencies=[
        audit_activity(
            "staff.viewed", "{{ actor.name }} viewed staff '{{ staff.name }}'"
        )
    ],
)
async def get_staff_detail(
    request: GetStaffDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStaffDetailApiResponse:
    """Get staff profile details with role visibility check."""
    tags = ["staff"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetStaffDetailApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get current user's profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # SQL function expects: target_profile_id (from request), profile_id (from header)
        params = GetStaffDetailSqlParams(
            **request.model_dump(), profile_id=uuid.UUID(profile_id)
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetStaffDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if staff exists and has access using SQL result
        # SQL now returns staff_exists field to distinguish 404 vs 403
        if not result.staff_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Profile {request.target_profile_id} not found",
            )

        if not result.profile_id:
            # Profile exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this profile. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                staff={
                    "name": result.name or "",
                    "id": str(result.profile_id) if result.profile_id else "",
                },
            )

        # Convert SQL result to API response
        api_response = GetStaffDetailApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_staff_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
