"""Upload PDF preview — first page as PNG."""

import os
import uuid as uuid_mod
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.globals import AUDIO_FOLDER, IMAGE_FOLDER, UPLOAD_FOLDER, get_db
from app.sql.types import (
    GetUploadFileInfoSqlParams,
    GetUploadFileInfoSqlRow,
    load_sql_query,
)
from app.utils.document.pdf_first_page_to_image_bytes import (
    pdf_first_page_to_image_bytes,
)
from app.utils.error.handle_route_error import handle_route_error
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/queries/uploads/get_upload_file_info_complete.sql"

router = APIRouter()


@router.get("/{upload_id}/preview", response_model=None)
async def preview_upload(
    upload_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Return a PNG preview of the first page of a PDF upload."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = (
            http_request.state.profile_id
            if hasattr(http_request.state, "profile_id")
            else None
        )

        upload_id_uuid = uuid_mod.UUID(upload_id)
        profile_id_uuid = (
            uuid_mod.UUID(profile_id)
            if profile_id
            else uuid_mod.UUID("00000000-0000-0000-0000-000000000000")
        )

        params = GetUploadFileInfoSqlParams(
            upload_id=upload_id_uuid,
            profile_id=profile_id_uuid,
        )
        sql_params = params.to_tuple()

        result = cast(
            GetUploadFileInfoSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result.upload_exists:
            raise HTTPException(status_code=404, detail="Upload not found")

        stored_path = result.file_path or ""
        if stored_path.startswith("audio/"):
            file_path = os.path.join(AUDIO_FOLDER, os.path.basename(stored_path))
        elif stored_path.startswith("image/"):
            file_path = os.path.join(IMAGE_FOLDER, os.path.basename(stored_path))
        else:
            file_path = os.path.join(UPLOAD_FOLDER, stored_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Upload file not found")

        content_type = get_content_type(result.file_path or "", result.mime_type or "")

        if content_type != "application/pdf":
            raise HTTPException(
                status_code=400, detail="Preview only supported for PDF files"
            )

        preview_bytes = pdf_first_page_to_image_bytes(file_path)
        if not preview_bytes:
            raise HTTPException(status_code=500, detail="Failed to generate preview")

        return Response(
            content=preview_bytes,
            media_type="image/png",
            headers={
                "Cache-Control": "private, max-age=3600, must-revalidate",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="preview_upload",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise
