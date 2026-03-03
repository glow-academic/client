"""Texts GET endpoint - v4 API.

Provides batch get endpoint for fetching texts by IDs.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import get_db
from app.v5.sql.types import (
    GetTextsApiRequest,
    GetTextsApiResponse,
    GetTextsSqlParams,
    GetTextsSqlRow,
    QGetTextsV4Item,
    load_sql_query,
)
from app.v5.utils.cache.cache_key import cache_key
from app.v5.utils.cache.get_cached import get_cached
from app.v5.utils.cache.set_cached import set_cached
from app.v5.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = "app/v5/sql/queries/resources/texts/get_texts_complete.sql"

router = APIRouter()


async def get_texts_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetTextsV4Item]:
    """Internal function for batch fetching texts by IDs."""
    if not ids:
        return []

    tags = ["resources", "texts"]
    cache_key_val = cache_key(
        "/api/v5/resources/texts/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetTextsV4Item.model_validate(item) for item in cached.get("items", [])
            ]

    params = GetTextsSqlParams(p_ids=ids)
    result = cast(
        GetTextsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetTextsV4Item] = result.items if result and result.items else []

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
    "/texts/get",
    response_model=GetTextsApiResponse,
)
async def get_texts(
    request: GetTextsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetTextsApiResponse:
    """Get texts resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "texts"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_texts_internal(conn, request.p_ids or [], bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetTextsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_texts",
            sql_query=load_sql_query(BATCH_SQL_PATH),
            sql_params=None,
            request=http_request,
        )
