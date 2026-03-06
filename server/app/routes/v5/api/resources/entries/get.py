"""Entries GET endpoint - v4 API following DHH principles."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db, get_redis_client
from app.routes.v5.tools.resources.entries.get import (
    get_entries as get_entries_resource,
)
from app.sql.types import (
    GetEntriesApiRequest,
    GetEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

# Load SQL with types at module level
router = APIRouter()


@router.post(
    "/entries/get",
    response_model=GetEntriesApiResponse,
)
async def get_entries(
    request: GetEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetEntriesApiResponse:
    """Get entries resources by IDs.

    HTTP wrapper that delegates to internal function for caching and data fetching.
    """
    tags = ["resources", "entries"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_entries_resource(
            conn, request.ids, get_redis_client(), bypass_cache
        )
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
