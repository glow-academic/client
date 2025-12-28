"""Settings list endpoint."""

from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (GetSettingsListApiRequest,
                           GetSettingsListApiResponse,
                           GetSettingsListSqlParams, GetSettingsListSqlRow,
                           load_sql_query)
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.cache_key import cache_key
from utils.cache.get_cached import get_cached
from utils.cache.set_cached import set_cached
from utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/settings/get_settings_list_complete.sql"


router = APIRouter()


@router.post(
    "/list",
    response_model=GetSettingsListApiResponse,
    dependencies=[
        audit_activity("settings.list", "{{ actor.name }} visited the Settings page")
    ],
)
async def list_settings(
    request: GetSettingsListApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetSettingsListApiResponse:
    """Get list of all settings ordered by created_at DESC."""
    tags = ["settings"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump(mode='json')
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return GetSettingsListApiResponse.model_validate(cached["data"])

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
        params = GetSettingsListSqlParams(**request.model_dump(), profile_id=profile_id)
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetSettingsListSqlRow,
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
        api_response = GetSettingsListApiResponse.model_validate(result.model_dump())

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
            operation="list_settings",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
