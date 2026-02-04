"""Group artifact endpoint - POST /artifacts/group/get"""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetPricingGroupDetailApiRequest,
    GetPricingGroupDetailApiResponse,
    GetPricingGroupDetailSqlParams,
    GetPricingGroupDetailSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/pricing/get_pricing_group_detail_complete.sql"

router = APIRouter()


@router.post(
    "/get",
    response_model=GetPricingGroupDetailApiResponse,
    dependencies=[audit_activity("group.get", "{{ actor.name }} viewed group detail")],
)
async def get_group(
    request: GetPricingGroupDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetPricingGroupDetailApiResponse:
    """Get detailed group information with all runs and messages."""
    tags = ["group"]  # From router tags

    # Validate request - must have group_id
    if not request.group_id:
        raise HTTPException(
            status_code=400,
            detail="Group ID is required.",
        )

    # Check for cache bypass header (for hard refresh)
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            response.headers["X-Cache-Tags"] = ",".join(tags)
            response.headers["X-Cache-Hit"] = "1"
            return GetPricingGroupDetailApiResponse.model_validate(cached["data"])

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert API request to SQL params (add profile_id from header)
        # Use double star pattern: **request.model_dump()
        params = GetPricingGroupDetailSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetPricingGroupDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if group exists
        if not result.group_exists:
            raise HTTPException(
                status_code=404,
                detail=f"Group not found: {request.group_id}",
            )

        # Check if access was denied (runs array is empty but group exists)
        if not result.runs or len(result.runs) == 0:
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this group. It may be restricted to other departments.",
            )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetPricingGroupDetailApiResponse.model_validate(
            result.model_dump()
        )

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode="json")},
            ttl=300,
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
            operation="get_group",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
