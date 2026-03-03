"""Responses entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.main import get_db
from app.v5.sql.types import (
    GetResponsesEntriesApiRequest,
    GetResponsesEntriesApiResponse,
    GetResponsesEntriesSqlParams,
    GetResponsesEntriesSqlRow,
    QGetSimulationResponsesViewV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/entries/responses/get_responses_entries_complete.sql"
VIEW_SQL_PATH = "app/v5/sql/queries/views/simulation/responses/get_simulation_responses_view_complete.sql"

router = APIRouter()


async def get_simulation_responses_internal(
    conn: asyncpg.Connection,
    chat_ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetSimulationResponsesViewV4Item]:
    """Internal function for fetching responses data."""
    from app.v5.sql.types import GetSimulationResponsesViewSqlParams

    cache_key_val = cache_key(
        "entries/responses/view",
        {
            "chat_ids": [str(x) for x in chat_ids],
        },
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetSimulationResponsesViewV4Item.model_validate(item)
                for item in cached["items"]
            ]

    params = GetSimulationResponsesViewSqlParams(chat_ids_filter=chat_ids)
    result = await execute_sql_typed(conn, VIEW_SQL_PATH, params=params)

    items: list[QGetSimulationResponsesViewV4Item] = (
        list(result.items) if result and result.items else []
    )

    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=["entries", "responses"],
    )
    return items


async def get_responses_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch responses entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "responses"]
    cache_key_val = cache_key(
        "/api/v5/entries/responses/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetResponsesEntriesSqlParams(ids=ids)
    result = cast(
        GetResponsesEntriesSqlRow,
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


@router.post(
    "/responses/get",
    response_model=GetResponsesEntriesApiResponse,
)
async def get_responses_entries(
    request: GetResponsesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetResponsesEntriesApiResponse:
    """Get responses entries by IDs."""
    tags = ["entries", "responses"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_responses_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetResponsesEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_responses_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
