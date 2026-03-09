"""Raw binary upload — PUT with metadata in query params."""

import os
import uuid

from fastapi import APIRouter, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import (
    AUDIO_FOLDER,
    UPLOAD_FOLDER,
    VIDEO_FOLDER,
    get_pool,
    get_redis_client,
)
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.mime.get_content_type import get_content_type

router = APIRouter()


class RawUploadResponse(BaseModel):
    upload_id: uuid.UUID


@router.put("/upload", response_model=RawUploadResponse)
async def raw_upload(
    http_request: Request,
    response: Response,
    filename: str = "upload.bin",
    subfolder: str | None = None,
) -> RawUploadResponse:
    """Upload a file via raw binary body.

    Send the file bytes directly as the request body with Content-Type: application/octet-stream.

    Query params:
        filename: Original filename with extension (e.g., "photo.png").
        subfolder: Optional — "audio" or "video". Defaults to general uploads folder.
    """
    tags = ["uploads"]

    try:
        file_bytes = await http_request.body()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty body")

        upload_uuid = uuid.uuid4()
        _, ext = os.path.splitext(filename)
        if not ext:
            ext = ".bin"

        if subfolder == "audio":
            target_folder = AUDIO_FOLDER
            final_file_path = f"audio/{upload_uuid}{ext}"
        elif subfolder == "video":
            target_folder = VIDEO_FOLDER
            final_file_path = f"video/{upload_uuid}{ext}"
        else:
            target_folder = UPLOAD_FOLDER
            final_file_path = f"{upload_uuid}{ext}"

        final_full_path = target_folder / f"{upload_uuid}{ext}"

        with open(final_full_path, "wb") as f:
            f.write(file_bytes)

        content_type = http_request.headers.get("content-type", "") or get_content_type(
            filename
        )
        if content_type == "application/octet-stream":
            content_type = get_content_type(filename)
        file_size = len(file_bytes)

        session_id = getattr(http_request.state, "session_id", None)

        pool = get_pool()
        async with pool.acquire() as conn:
            result = await create_upload(
                conn,
                session_id=uuid.UUID(session_id) if session_id else uuid.UUID(int=0),
                file_path=final_file_path,
                mime_type=content_type,
                size=file_size,
            )

        await invalidate_tags(tags, redis=get_redis_client())
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return RawUploadResponse(upload_id=result.id)

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="raw_upload",
            request=http_request,
        )
        raise
