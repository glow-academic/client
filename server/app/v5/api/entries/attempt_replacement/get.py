"""Attempt Replacement entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetAttemptReplacementEntriesApiRequest,
    GetAttemptReplacementEntriesApiResponse,
    GetAttemptReplacementEntriesSqlParams,
    GetAttemptReplacementEntriesSqlRow,
    QGetSimulationReplacementsViewV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/attempt_replacement/get_attempt_replacement_entries_complete.sql"
VIEW_SQL_PATH = "app/v5/sql/queries/views/simulation/replacements/get_simulation_replacements_view_complete.sql"

router = APIRouter()


async def get_attempt_replacement_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch attempt_replacement entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "attempt_replacement"]
    cache_key_val = cache_key(
        "/api/v5/entries/attempt_replacement/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetAttemptReplacementEntriesSqlParams(ids=ids)
    result = cast(
        GetAttemptReplacementEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


async def get_attempt_replacement_internal(
    conn: asyncpg.Connection,
    improvement_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationReplacementsViewV4Item]:
    """Internal function for fetching replacements data."""
    from app.v5.sql.types import GetSimulationReplacementsViewSqlParams

    cache_key_val = cache_key(
        "entries/attempt_replacement/view",
        {
            "improvement_ids": [str(x) for x in improvement_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSimulationReplacementsViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationReplacementsViewSqlParams(
        improvement_ids_filter=improvement_ids
    )
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationReplacementsViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "attempt_replacement"],
    )
    return items


@router.post(
    "/attempt_replacement/get",
    response_model=GetAttemptReplacementEntriesApiResponse,
)
async def get_attempt_replacement_entries(
    request: GetAttemptReplacementEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAttemptReplacementEntriesApiResponse:
    """Get attempt_replacement entries by IDs."""
    tags = ["entries", "attempt_replacement"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_attempt_replacement_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAttemptReplacementEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_attempt_replacement_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
