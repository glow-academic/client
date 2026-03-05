"""Activity entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.activity.get import get_activity
from app.sql.types import (
    GetActivityEntriesApiRequest,
    GetActivityEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/activity/get",
    response_model=GetActivityEntriesApiResponse,
)
async def get_activity_entries(
    request: GetActivityEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetActivityEntriesApiResponse:
    """Get activity entries by IDs."""
    tags = ["entries", "activity"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_activity(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetActivityEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_activity_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
