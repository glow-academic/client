"""Audios entry GET endpoint."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.audios.get import get_audio
from app.sql.types import (
    GetAudiosEntriesApiRequest,
    GetAudiosEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()


@router.post(
    "/audios/get",
    response_model=GetAudiosEntriesApiResponse,
)
async def get_audios_entries(
    request: GetAudiosEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetAudiosEntriesApiResponse:
    """Get audios entries by IDs."""
    tags = ["entries", "audios"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_audio(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetAudiosEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_audios_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
