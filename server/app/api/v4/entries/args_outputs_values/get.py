"""Args Outputs Values entry GET endpoint."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetArgsOutputsValuesEntriesApiRequest,
    GetArgsOutputsValuesEntriesApiResponse,
    GetArgsOutputsValuesEntriesSqlParams,
    GetArgsOutputsValuesEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/args_outputs_values/get_args_outputs_values_entries_complete.sql"

router = APIRouter()


async def get_args_outputs_values_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch args_outputs_values entries by IDs."""
    if not ids:
        return []

    tags = ["entries", "args_outputs_values"]
    cache_key_val = cache_key(
        "/api/v4/entries/args_outputs_values/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetArgsOutputsValuesEntriesSqlParams(ids=ids)
    result = cast(
        GetArgsOutputsValuesEntriesSqlRow,
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
    "/args_outputs_values/get",
    response_model=GetArgsOutputsValuesEntriesApiResponse,
)
async def get_args_outputs_values_entries(
    request: GetArgsOutputsValuesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetArgsOutputsValuesEntriesApiResponse:
    """Get args_outputs_values entries by IDs."""
    tags = ["entries", "args_outputs_values"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_args_outputs_values_entries_internal(
            conn, request.ids, bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetArgsOutputsValuesEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_args_outputs_values_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
