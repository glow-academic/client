"""Cohorts SEARCH endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Import the locally-defined type from get.py
from app.routes.v5.api.resources.cohorts.types import (
    QGetCohortsV4Item,
    SearchCohortsApiRequest,
    SearchCohortsApiResponse,
    SearchCohortsSqlRow,
)
from app.utils.error.handle_route_error import handle_route_error
from app.globals import get_db
from app.sql.types import SearchCohortsSqlParams
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/resources/cohorts/search_cohorts_complete.sql"

router = APIRouter()


async def search_cohorts_internal(
    conn: asyncpg.Connection,
    search: str | None = None,
    limit_count: int | None = 20,
    offset_count: int | None = 0,
    exclude_ids: list[UUID] | None = None,
    department_ids: list[UUID] | None = None,
    simulation_ids: list[UUID] | None = None,
    bypass_cache: bool = False,
    *,
    cohort: bool = False,
    profile: bool = False,
) -> list[QGetCohortsV4Item]:
    """Internal function to search cohorts."""
    if limit_count is not None and limit_count <= 0:
        return []

    tags = ["resources", "cohorts"]
    cache_key_val = cache_key(
        "/api/v5/resources/cohorts/search",
        {
            "search": search,
            "limit_count": limit_count,
            "offset_count": offset_count,
            "exclude_ids": [str(id) for id in (exclude_ids or [])],
            "department_ids": sorted(str(i) for i in (department_ids or [])),
            "simulation_ids": sorted(str(i) for i in (simulation_ids or [])),
            "cohort": cohort,
            "profile": profile,
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetCohortsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = SearchCohortsSqlParams(
        search=search,
        limit_count=limit_count,
        offset_count=offset_count,
        exclude_ids=exclude_ids or [],
        department_ids=department_ids or [],
        simulation_ids=simulation_ids or [],
        cohort=cohort,
        profile=profile,
    )
    result = cast(
        SearchCohortsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetCohortsV4Item] = (
        [
            QGetCohortsV4Item.model_validate(
                item.model_dump() if hasattr(item, "model_dump") else item
            )
            for item in (result.items or [])
        ]
        if result
        else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


# =============================================================================
# HTTP Endpoint
# =============================================================================


@router.post(
    "/cohorts/search",
    response_model=SearchCohortsApiResponse,
)
async def search_cohorts(
    request: SearchCohortsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> SearchCohortsApiResponse:
    """Search cohorts resources."""
    tags = ["resources", "cohorts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await search_cohorts_internal(
            conn,
            request.search,
            request.limit_count,
            request.offset_count,
            request.exclude_ids,
            bypass_cache=bypass_cache,
            cohort=request.cohort or False,
            profile=request.profile or False,
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return SearchCohortsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="search_cohorts",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
