"""Resolves entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.resolves.get import get_resolves
from app.sql.types import (
    GetResolvesEntriesApiRequest,
    GetResolvesEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/resolves/get",
    response_model=GetResolvesEntriesApiResponse,
)
async def get_resolves_entries(
    request: GetResolvesEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetResolvesEntriesApiResponse:
    """Get resolves entries by IDs."""
    tags = ["entries", "resolves"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_resolves(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetResolvesEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_resolves_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
