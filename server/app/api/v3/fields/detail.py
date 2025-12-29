"""Field detail endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetFieldDetailApiRequest,
    GetFieldDetailApiResponse,
    GetFieldDetailSqlParams,
    GetFieldDetailSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/fields/get_field_detail_complete.sql"


router = APIRouter()


@router.post(
    "/detail",
    response_model=GetFieldDetailApiResponse,
    dependencies=[
        audit_activity(
            "field.viewed", "{{ actor.name }} viewed field '{{ field.name }}'"
        )
    ],
)
async def get_field_detail(
    request: GetFieldDetailApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetFieldDetailApiResponse:
    """Get detailed field information."""
    tags = ["fields"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        cached_data = cached["data"]
        if "can_edit" not in cached_data:
            cached_data["can_edit"] = False
        return GetFieldDetailApiResponse.model_validate(cached_data)

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
        params = GetFieldDetailSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            GetFieldDetailSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if field exists and has access using SQL result
        # SQL now returns field_exists field to distinguish 404 vs 403
        if not result.field_exists:
            raise HTTPException(
                status_code=404, detail=f"Field not found: {request.field_id}"
            )

        if not result.name:
            # Field exists but user doesn't have access
            raise HTTPException(
                status_code=403,
                detail="You don't have access to this field. It may be restricted to other departments.",
            )

        # Set audit context with data from SQL query
        actor_name = result.actor_name
        field_name = result.name
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                field={"name": field_name, "id": str(request.field_id)},
            )

        # Convert SQL result to API response
        # Return arrays directly from SQL result (no mapping construction)
        api_response = GetFieldDetailApiResponse.model_validate(result.model_dump())

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
            operation="get_field_detail",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
