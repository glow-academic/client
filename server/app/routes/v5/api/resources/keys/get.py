"""Keys GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.keys.get import SQL_PATH, get_keys_internal
from app.sql.types import (
    GetKeysApiRequest,
    GetKeysApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/keys/get",
    response_model=GetKeysApiResponse,
)
async def get_keys(
    request: GetKeysApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetKeysApiResponse:
    """Get keys resources by IDs."""
    tags = ["resources", "keys"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_keys_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetKeysApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_keys",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
