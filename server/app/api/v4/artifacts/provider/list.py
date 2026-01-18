"""Providers list endpoint - v4 API following DHH principles."""

from typing import Annotated, Any, cast

import asyncpg
from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetProvidersListApiRequest,
                           GetProvidersListApiResponse,
                           GetProvidersListSqlParams, GetProvidersListSqlRow,
                           load_sql_query)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/providers/get_providers_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=GetProvidersListApiResponse,
    dependencies=[
        audit_activity("providers.list", "{{ actor.name }} visited the Providers page")
    ],
)
async def get_provider_list(
    request: GetProvidersListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProvidersListApiResponse:
    """Get providers list with permissions and endpoint info."""
    tags = ["providers"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode="json")
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetProvidersListApiResponse.model_validate(cached["data"])

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
        params = GetProvidersListSqlParams(profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetProvidersListSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Set audit context
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

        # Convert SQL result to API response (no manual filtering needed - SQL handles it)
        api_response = GetProvidersListApiResponse.model_validate(result.model_dump())

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
            operation="get_provider_list",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
