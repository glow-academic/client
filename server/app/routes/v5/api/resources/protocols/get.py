"""Protocols GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.resources.protocols.get import SQL_PATH, get_protocols_internal
from app.sql.types import (
    GetProtocolsApiRequest,
    GetProtocolsApiResponse,
    load_sql_query,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/protocols/get",
    response_model=GetProtocolsApiResponse,
)
async def get_protocols(
    request: GetProtocolsApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetProtocolsApiResponse:
    """Get protocols resources by IDs."""
    tags = ["resources", "protocols"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_protocols_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetProtocolsApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_protocols",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )
