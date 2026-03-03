"""Upload file download — streaming with HTTP Range support."""

import os
import urllib.parse
import uuid as uuid_mod
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from fastapi.responses import FileResponse, StreamingResponse

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.globals import AUDIO_FOLDER, IMAGE_FOLDER, UPLOAD_FOLDER, get_db
from app.v5.sql.types import (
    GetUploadFileInfoSqlParams,
    GetUploadFileInfoSqlRow,
    load_sql_query,
)
from app.v5.utils.mime.get_content_type import get_content_type
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/uploads/get_upload_file_info_complete.sql"

router = APIRouter()


def _create_range_streaming_response(
    file_path: str,
    content_type: str,
    range_header: str | None,
    content_disposition: str,
) -> Response:
    """Create a streaming response with HTTP Range support for video seeking."""
    file_size = os.path.getsize(file_path)
    start = 0
    end = file_size - 1

    if range_header:
        range_spec = range_header.replace("bytes=", "")
        if "-" in range_spec:
            parts = range_spec.split("-")
            if parts[0]:
                start = int(parts[0])
            if parts[1]:
                end = int(parts[1])

    if start >= file_size:
        start = 0
    if end >= file_size:
        end = file_size - 1

    content_length = end - start + 1
    chunk_size = 1024 * 1024

    def iter_file():
        with open(file_path, "rb") as f:
            f.seek(start)
            remaining = content_length
            while remaining > 0:
                read_size = min(chunk_size, remaining)
                data = f.read(read_size)
                if not data:
                    break
                remaining -= len(data)
                yield data

    headers = {
        "Content-Disposition": content_disposition,
        "Accept-Ranges": "bytes",
        "Content-Length": str(content_length),
        "Content-Range": f"bytes {start}-{end}/{file_size}",
        "Cache-Control": "private, max-age=0, must-revalidate",
    }

    status_code = 206 if range_header else 200
    return StreamingResponse(
        iter_file(),
        status_code=status_code,
        media_type=content_type,
        headers=headers,
    )


@router.get("/{upload_id}/download", response_model=None)
async def download_upload(
    upload_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FileResponse | Response:
    """Download an upload file by ID."""
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

        filename = os.path.basename(result.file_path or "")
        encoded_filename = urllib.parse.quote(filename, safe="")
        content_disposition = f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"

        if content_type.startswith("video/"):
            range_header = http_request.headers.get("range")
            return _create_range_streaming_response(
                file_path=file_path,
                content_type=content_type,
                range_header=range_header,
                content_disposition=content_disposition,
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
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="download_upload",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise
