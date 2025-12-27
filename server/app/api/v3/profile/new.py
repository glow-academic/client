"""Profile new endpoint - get default profile details for creation."""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetProfileNewApiRequest, GetProfileNewApiResponse,
                           GetProfileNewSqlParams, GetProfileNewSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/profile/get_profile_new_complete.sql"

router = APIRouter()


@router.post(
    "/new",
    response_model=GetProfileNewApiResponse,
    dependencies=[
        audit_activity("profile.new", "{{ actor.name }} viewed new profile form")
    ],
)
async def get_profile_new(
    request: GetProfileNewApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProfileNewApiResponse:
    """Get default profile structure for creation mode."""
    tags = ["profile"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetProfileNewApiResponse.model_validate(cached["data"])

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
        params = GetProfileNewSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute SQL with typed helper (single row result)
        result = cast(
            GetProfileNewSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response
        response_data = GetProfileNewApiResponse.model_validate(result.model_dump())

        # Cache response (use mode='json' to serialize UUIDs and other types)
        await set_cached(
            cache_key_val,
            {"data": response_data.model_dump(mode='json')},
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
            operation="get_profile_new",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
