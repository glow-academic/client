"""Group video download — streaming with HTTP Range support for seeking."""

import os
import urllib.parse
import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from fastapi.responses import StreamingResponse

from app.infra.globals import VIDEO_FOLDER, get_pool
from app.tools.entries.uploads.get import get_upload
from app.utils.error.handle_route_error import handle_route_error
from app.utils.mime.get_content_type import get_content_type

router = APIRouter(prefix="/video", tags=["group-video"])


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
async def download_video(
    upload_id: str,
    http_request: Request,
) -> Response:
    """Download a video file by upload ID with range support for seeking."""
    try:
        upload_id_uuid = uuid.UUID(upload_id)

        pool = get_pool()
        async with pool.acquire() as conn:
            result = await get_upload(conn, upload_id_uuid)

        if result is None:
            raise HTTPException(status_code=404, detail="Upload not found")

        stored_path = result.file_path or ""
        file_path = os.path.join(VIDEO_FOLDER, os.path.basename(stored_path))

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Video file not found")

        content_type = get_content_type(result.file_path or "", result.mime_type or "")

        filename = os.path.basename(result.file_path or "")
        encoded_filename = urllib.parse.quote(filename, safe="")
        content_disposition = f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"

        range_header = http_request.headers.get("range")
        return _create_range_streaming_response(
            file_path=file_path,
            content_type=content_type,
            range_header=range_header,
            content_disposition=content_disposition,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="download_group_video",
            request=http_request,
        )
        raise
