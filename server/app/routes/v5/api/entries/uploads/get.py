"""Uploads entry GET endpoint — MV metadata only."""

from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import get_db
from app.routes.v5.tools.entries.uploads.get import get_upload
from app.sql.types import (
    GetUploadsEntriesApiRequest,
    GetUploadsEntriesApiResponse,
)
from app.utils.error.handle_route_error import handle_route_error

router = APIRouter()

# ============================================================================
# MCP mode: Return metadata from uploads_mv
# ============================================================================


@router.post(
    "/uploads/get",
    response_model=GetUploadsEntriesApiResponse,
)
async def get_uploads_entries(
    request: GetUploadsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetUploadsEntriesApiResponse:
    """Get uploads entries by IDs.

    MCP mode: Returns upload metadata (file_path, mime_type, size, created_at).
    Normal mode: Also returns metadata (use /uploads/download/{id} for file content).
    """
    tags = ["entries", "uploads"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_upload(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetUploadsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_uploads_entries",
            sql_query=None,
            sql_params=None,
            request=http_request,
        )
