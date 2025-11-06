"""Document download endpoint - v3 API following DHH principles."""

import os
import urllib.parse
from typing import Annotated

import asyncpg  # type: ignore
from app.db import get_db
from app.extensions import UPLOAD_FOLDER
from app.utils.mime_utils import get_content_type
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse

router = APIRouter()


@router.get("/download/{document_id}")
async def download_document(
    document_id: str,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FileResponse:
    """Download a document by ID."""
    try:
        sql = load_sql("sql/v3/documents/get_document_file_info.sql")
        result = await conn.fetchrow(sql, document_id)

        if not result:
            raise HTTPException(status_code=404, detail="Document not found")

        file_path = os.path.join(UPLOAD_FOLDER, result["file_path"])

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Document file not found")

        content_type = get_content_type(result["name"], result["mime_type"])

        # Properly encode filename for HTTP headers
        encoded_filename = urllib.parse.quote(result["name"], safe="")
        content_disposition = (
            f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"
        )

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
        raise HTTPException(status_code=500, detail=str(e))

