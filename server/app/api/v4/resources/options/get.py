"""Options GET endpoint - v4 API.

Provides get endpoint for batch fetching options by IDs.
"""

from typing import Annotated, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.api.v4.resources.options.types import (
    GetOptionsApiRequest,
    GetOptionsApiResponse,
    GetOptionV4Item,
)
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import get_db
from app.sql.types import (
    GetOptionsSqlParams,
    GetOptionsSqlRow,
    QGetOptionsV4Item,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.sql_helper import execute_sql_typed

BATCH_SQL_PATH = "app/sql/v4/queries/resources/options/get_options_complete.sql"

router = APIRouter()

# =============================================================================
# Internal Function
# =============================================================================


async def get_options_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[QGetOptionsV4Item]:
    """Internal function for batch fetching options by IDs.

    This is a simple fetch without active flag check.
    """
    if not ids:
        return []

    tags = ["resources", "options"]
    cache_key_val = cache_key(
        "/api/v4/resources/options/get-batch",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return [
                QGetOptionsV4Item.model_validate(item)
                for item in cached.get("items", [])
            ]

    params = GetOptionsSqlParams(p_ids=ids)
    result = cast(
        GetOptionsSqlRow,
        await execute_sql_typed(conn, BATCH_SQL_PATH, params=params),
    )

    items: list[QGetOptionsV4Item] = result.items if result and result.items else []

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
    "/options/get",
    response_model=GetOptionsApiResponse,
)
async def get_options(
    request: GetOptionsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetOptionsApiResponse:
    """Get options by IDs."""
    tags = ["resources", "options"]

    try:
        bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"
        items = await get_options_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetOptionsApiResponse(
            items=[
                GetOptionV4Item(
                    option_id=item.option_id,
                    option_text=item.option_text,
                    is_correct=item.is_correct,
                    generated=item.generated,
                )
                for item in items
            ]
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_options",
            sql_query=load_sql_query(BATCH_SQL_PATH),
            sql_params=None,
            request=http_request,
        )
