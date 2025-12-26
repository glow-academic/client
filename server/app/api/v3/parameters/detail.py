"""Parameter detail endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetParameterDetailApiRequest,
                           GetParameterDetailApiResponse,
                           GetParameterDetailSqlParams,
                           GetParameterDetailSqlRow, load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/parameters/get_parameter_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetParameterDetailApiResponse,
    dependencies=[
        audit_activity(
            "parameter.detail",
            "{{ actor.name }} viewed parameter '{{ parameter.name }}'",
        )
    ],
)
async def get_parameter_detail(
    request: GetParameterDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetParameterDetailApiResponse:
    """Get detailed parameter information with nested items."""
    tags = ["parameters"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetParameterDetailApiResponse.model_validate(cached["data"])

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
        params = GetParameterDetailSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetParameterDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if parameter exists and has access using SQL result
        # SQL now returns parameter_exists field to distinguish 404 vs 403
        if not result.parameter_exists:
            raise HTTPException(
                status_code=404, detail=f"Parameter {request.parameter_id} not found"
            )
        
        if not result.name:
            # Parameter exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this parameter. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        actor_name = result.actor_name
        parameter_name = result.name
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                parameter={"name": parameter_name, "id": str(request.parameter_id)},
            )

        # Convert SQL result to API response (no manual conversion needed - SQL returns arrays)
        api_response = GetParameterDetailApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": api_response.model_dump(mode='json')},
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
            operation="get_parameter_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
