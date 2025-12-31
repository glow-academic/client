"""Department detail endpoint - v4 API."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetDepartmentDetailApiRequest,
    GetDepartmentDetailApiResponse,
    GetDepartmentDetailSqlParams,
    GetDepartmentDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/departments/get_department_detail_complete.sql"

router = APIRouter()


@router.post(
    "/detail",
    response_model=GetDepartmentDetailApiResponse,
    dependencies=[
        audit_activity(
            "department.viewed",
            "{{ actor.name }} viewed department '{{ department.title }}'",
        )
    ],
)
async def get_department_detail(
    request: GetDepartmentDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetDepartmentDetailApiResponse:
    """Get department detail with permissions, stats, and settings."""
    tags = ["departments"]  # From router tags

    # Generate cache key from path and parsed body (use mode='json' for UUID serialization)
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetDepartmentDetailApiResponse.model_validate(cached["data"])

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
        # Note: request.department_id is snake_case (frontend should convert camelCase)
        params = GetDepartmentDetailSqlParams(
            **request.model_dump(), profile_id=profile_id
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetDepartmentDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if department exists and has access using SQL result
        # SQL now returns department_exists field to distinguish 404 vs 403
        if not result.department_exists:
            raise HTTPException(
                status_code=404, detail=f"Department {request.department_id} not found"
            )

        if not result.department_id:
            # Department exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this department. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                department={"title": result.title, "id": str(request.department_id)},
            )

        # Convert SQL result to API response
        response_data = GetDepartmentDetailApiResponse.model_validate(
            result.model_dump()
        )

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
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_department_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
