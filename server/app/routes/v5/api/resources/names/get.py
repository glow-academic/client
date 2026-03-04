"""Names GET endpoint — v5 API."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.names.get import get_names
from app.routes.v5.tools.resources.names.types import GetNamesRequest, GetNamesResponse
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/names/get",
    response_model=GetNamesResponse,
)
async def get_names_endpoint(
    request: GetNamesRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetNamesResponse:
    """Get names resources by IDs."""
    tags = ["resources", "names"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_names(conn, request.ids, get_redis_client(), bypass_cache=bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetNamesResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_names",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
