"""Texts GET endpoint - v4 API.

Provides batch get endpoint for fetching texts by IDs.
"""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.texts.get import BATCH_SQL_PATH, get_texts_internal
from app.sql.types import (
    GetTextsApiRequest,
    GetTextsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

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
