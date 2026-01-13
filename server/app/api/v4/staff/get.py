"""Staff get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (staff_id = NULL) and detail (staff_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetStaffApiRequest,
    GetStaffApiResponse,
    GetStaffSqlParams,
    GetStaffSqlRow,
    load_sql_query,
)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/staff/get_staff_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetStaffApiResponse,
    dependencies=[
        audit_activity(
            "staff.get",
            "{{ actor.name }} {% if staff %}viewed{% else %}opened new{% endif %} staff{% if staff %} '{{ staff.name }}'{% endif %}",
        )
    ],
)
async def get_staff(
    request: GetStaffApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetStaffApiResponse:
    """Get staff information - handles both new (staff_id = NULL) and detail (staff_id provided).
    
    Validation Logic:
    - Tools are REQUIRED for resources - error if no tools exist (via missing_tools_check CTE)
    - Agents are OPTIONAL - NULL agent_id means manual entry only (no generate button shown)
    - Frontend components check agent_id before showing generate button
    """
    tags = ["staff"]  # From router tags

    # Check for cache bypass header (for testing)
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
            return GetStaffApiResponse.model_validate(cached["data"])

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

        staff_id = request.staff_id  # Can be NULL for new mode
        draft_id = request.draft_id

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        # Convert API request to SQL params (add profile_id and mcp from header)
        params = GetStaffSqlParams(
            staff_id=staff_id,
            profile_id=profile_id,
            draft_id=draft_id,
            mcp=mcp,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetStaffSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            if staff_id:
                # Detail mode: add staff to audit context
                audit_ctx["staff"] = {
                    "name": result.name or "Staff",
                    "id": str(staff_id),
                }
            audit_set(http_request, **audit_ctx)

        # Convert SQL result to API response
        api_response = GetStaffApiResponse.model_validate(result.model_dump())

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
            operation="get_staff",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
