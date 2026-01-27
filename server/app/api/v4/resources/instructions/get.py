"""Instructions GET endpoint - v4 API following DHH principles."""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetInstructionsApiRequest,
    GetInstructionsApiResponse,
    GetInstructionsSqlParams,
    GetInstructionsSqlRow,
    QGetInstructionsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed
from fastapi import APIRouter, Depends, HTTPException, Request, Response

# Load SQL with types at module level
SQL_PATH = "app/sql/v4/queries/resources/instructions/get_instructions_complete.sql"


router = APIRouter()


async def get_instructions_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetInstructionsV4Item]:
    """Internal function to fetch instructions by IDs.

    Can be called directly from other routes without HTTP overhead.
    """
    if not ids:
        return []

    tags = ["resources", "instructions"]
    cache_key_val = cache_key(
        "/api/v4/resources/instructions/get",
        {"ids": [str(id) for id in ids]},
    )

    # Try cache (unless bypassed)
    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [QGetInstructionsV4Item.model_validate(item) for item in cached.get("items", [])]

    # Execute SQL
    params = GetInstructionsSqlParams(ids=ids)
    result = cast(
        GetInstructionsSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[QGetInstructionsV4Item] = result.items if result and result.items else []

    # Cache result
    await set_cached(
        cache_key_val,
        {"items": [item.model_dump(mode="json") for item in items]},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/instructions/get",
    response_model=GetInstructionsApiResponse,
)
async def get_instructions(
    request: GetInstructionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetInstructionsApiResponse:
    """Get instructions resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "instructions"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_instructions_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetInstructionsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_instructions",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
