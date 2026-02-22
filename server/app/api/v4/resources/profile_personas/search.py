"""Profile personas search endpoint - v4 API.

Provides search endpoint for finding available profile personas for profiles.
"""

from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    QGetProfilePersonasV4Item,
    SearchProfilePersonasApiRequest,
    SearchProfilePersonasApiResponse,
    SearchProfilePersonasSqlParams,
    SearchProfilePersonasSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = (
    "app/sql/v4/queries/resources/profile_personas/search_profile_personas_complete.sql"
)


router = APIRouter()


async def search_profile_personas_internal(
    conn: asyncpg.Connection,
    profile_ids: list[UUID],
    persona_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
) -> list[QGetProfilePersonasV4Item]:
    """Internal function for parallel fetching from artifact endpoint.

    Args:
        conn: Database connection
        profile_ids: List of profile IDs to search personas for
        bypass_cache: Whether to bypass cache

    Returns:
        List of available profile persona items
    """
    # Generate cache key
    cache_key_val = cache_key(
        "profile_personas/search",
        {
            "profile_ids": sorted([str(id) for id in profile_ids]),
            "persona_ids": sorted(str(i) for i in (persona_ids or [])),
            "cohort": cohort,
        },
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetProfilePersonasV4Item.model_validate(item)
                for item in cached.get("data", [])
            ]

    # Execute SQL
    params = SearchProfilePersonasSqlParams(
        profile_ids=profile_ids or [],
        persona_ids=persona_ids or [],
        cohort=cohort,
    )
    result = cast(
        SearchProfilePersonasSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH,
            params=params,
        ),
    )

    items = result.items or []

    # Cache response
    await set_cached(
        cache_key_val,
        {"data": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["profile_personas"],
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/profile_personas/search",
    response_model=SearchProfilePersonasApiResponse,
)
async def search_profile_personas(
    request: SearchProfilePersonasApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchProfilePersonasApiResponse:
    """Search available profile personas for profiles."""
    tags = ["resources", "profile_personas"]

    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

        items = await search_profile_personas_internal(
            conn=conn,
            profile_ids=request.profile_ids or [],
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
        )

        api_response = SearchProfilePersonasApiResponse(items=items)
        response.headers["X-Cache-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_profile_personas",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
