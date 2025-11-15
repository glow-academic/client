"""Document download endpoint - v3 API following DHH principles."""

import os
import urllib.parse
from typing import Annotated, Any

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import FileResponse

from app.main import UPLOAD_FOLDER, get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import load_sql

router = APIRouter()


@router.get("/download/{document_id}")
async def download_document(
    document_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FileResponse:
    """Download a document by ID."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        sql_query = load_sql("sql/v3/documents/get_document_file_info.sql")
        sql_params = (document_id,)
        result = await conn.fetchrow(sql_query, document_id)

        if not result:
            raise HTTPException(status_code=404, detail="Document not found")

        file_path = os.path.join(UPLOAD_FOLDER, result["file_path"])

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Document file not found")

        content_type = get_content_type(result["name"], result["mime_type"])

        # Properly encode filename for HTTP headers
        encoded_filename = urllib.parse.quote(result["name"], safe="")
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
            operation="download_document",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
