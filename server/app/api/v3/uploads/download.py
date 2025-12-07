"""Upload download endpoint - v3 API following DHH principles."""

import os
import urllib.parse
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from app.main import AUDIO_FOLDER, UPLOAD_FOLDER, get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import load_sql

router = APIRouter()


@router.get("/download/{upload_id}")
async def download_upload(
    upload_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FileResponse:
    """Download an upload by ID."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/uploads/get_upload_file_info.sql")
        sql_params = (upload_id,)
        result = await conn.fetchrow(sql_query, upload_id)

        if not result:
            raise HTTPException(status_code=404, detail="Upload not found")

        # Handle subfolder paths (e.g., "audio/uuid.ext")
        stored_path = result["file_path"]
        if stored_path.startswith("audio/"):
            file_path = os.path.join(AUDIO_FOLDER, os.path.basename(stored_path))
        else:
            file_path = os.path.join(UPLOAD_FOLDER, stored_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Upload file not found")

        content_type = get_content_type(result["file_path"], result["mime_type"])

        # Extract filename from file_path (remove directory if present)
        filename = os.path.basename(result["file_path"])

        # Properly encode filename for HTTP headers
        encoded_filename = urllib.parse.quote(filename, safe="")
        content_disposition = f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"

        return FileResponse(
            path=file_path,
            media_type=content_type,
            headers={
                "Content-Disposition": content_disposition,
                "Cache-Control": "private, max-age=0, must-revalidate",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="download_upload",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise

