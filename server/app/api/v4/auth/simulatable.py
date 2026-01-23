"""Search simulatable profiles endpoint - search profiles that can be emulated."""

from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    SearchSimulatableProfilesApiRequest,
    SearchSimulatableProfilesApiResponse,
    SearchSimulatableProfilesSqlParams,
    SearchSimulatableProfilesSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/profile/search_simulatable_profiles_complete.sql"

router = APIRouter()


@router.post(
    "/simulatable",
    response_model=SearchSimulatableProfilesApiResponse,
    dependencies=[
        audit_activity(
            "profile.simulatable", "{{ actor.name }} searched simulatable profiles"
        )
    ],
)
async def search_simulatable_profiles(
    request: SearchSimulatableProfilesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchSimulatableProfilesApiResponse:
    """Search profiles that can be emulated by the requester."""
    tags = ["profile"]  # From router tags

    # Generate cache key from path and parsed body
    body_dict = request.model_dump()
    cache_key_val = cache_key(http_request.url.path, body_dict)

    # Try cache
    cached = await get_cached(cache_key_val)
    if cached:
        response.headers["X-Cache-Tags"] = ",".join(tags)
        response.headers["X-Cache-Hit"] = "1"
        return SearchSimulatableProfilesApiResponse.model_validate(cached["data"])

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

        # Convert API request to SQL params using double star pattern
        # Auto-generated types: limit_count (int), query (str)
        # SQL function handles empty query string
        params = SearchSimulatableProfilesSqlParams(
            **request.model_dump(),
            profile_id=profile_id,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        result = cast(
            SearchSimulatableProfilesSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Convert SQL result to API response (auto-generated types, no manual transformation)
        response_data = SearchSimulatableProfilesApiResponse.model_validate(
            result.model_dump()
        )

        # Set audit context using actor_name from SQL result
        if result.actor_name:
            audit_set(http_request, actor={"name": result.actor_name, "id": profile_id})

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
            operation="search_simulatable_profiles",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
