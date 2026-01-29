"""Department get endpoint - v4 API following DHH principles.
Unified endpoint that handles both new (department_id = NULL) and detail (department_id provided).
"""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetDepartmentApiRequest,
    GetDepartmentApiResponse,
    GetDepartmentSqlParams,
    GetDepartmentSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/departments/get_department_complete.sql"


router = APIRouter()


@router.post(
    "/get",
    response_model=GetDepartmentApiResponse,
    dependencies=[
        audit_activity(
            "department.get",
            "{{ actor.name }} {% if department %}viewed{% else %}opened new{% endif %} department{% if department %} '{{ department.title }}'{% endif %}",
        )
    ],
)
async def get_department(
    request: GetDepartmentApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDepartmentApiResponse:
    """Get department information - handles both new (department_id = NULL) and detail (department_id provided).

    Validation Logic:
    - Tools are REQUIRED for resources - error if no tools exist (via missing_tools_check CTE)
    - Agents are OPTIONAL - NULL agent_id means manual entry only (no generate button shown)
    - Frontend components check agent_id before showing generate button
    """
    tags = ["departments"]  # From router tags

    # Generate cache key from path and parsed body
    # Use mode='json' to serialize UUIDs to strings for JSON compatibility
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetDepartmentApiResponse.model_validate(cached["data"])

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

        # Extract params from API request
        draft_id = request.draft_id
        department_id = request.department_id  # Can be NULL for new mode

        # Get mcp flag from header (set by router-level dependency)
        mcp = getattr(http_request.state, "mcp", False) or False

        # Convert API request to SQL params (add profile_id and mcp from header)
        params = GetDepartmentSqlParams(
            department_id=department_id,
            profile_id=profile_id,
            draft_id=draft_id,
            mcp=mcp,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper
        result = cast(
            GetDepartmentSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_ctx = {"actor": {"name": result.actor_name, "id": profile_id}}
            # Only add department to audit context if department_id was provided (detail mode)
            if department_id and result.name_resource and result.name_resource.name:
                audit_ctx["department"] = {
                    "title": result.name_resource.name,
                    "id": str(department_id),
                }
            audit_set(http_request, **audit_ctx)

        # Conditional validation based on mode
        if department_id is None:
            # New mode: no validation needed - just return default data
            pass
        else:
            # Detail mode: check if department exists and has access
            if result.department_exists is False:
                raise HTTPException(
                    status_code=404, detail=f"Department {department_id} not found"
                )

            if not result.name_resource or not result.name_resource.name:
                # Department exists but user doesn't have access
                raise HTTPException(
                    status_code=403,
                    detail="You don't have access to this department. It may be restricted to other departments.",
                )

        # Convert SQL result to API response
        response_data = GetDepartmentApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode="json")},
            ttl=60,
            tags=tags,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "0"

        return response_data
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_department",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
