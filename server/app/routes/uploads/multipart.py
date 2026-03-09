"""Multipart form-data upload — standard POST with file field."""

import os
import uuid

from fastapi import APIRouter, HTTPException, Request, Response, UploadFile
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


class MultipartUploadResponse(BaseModel):
    upload_id: uuid.UUID


@router.post("/upload", response_model=MultipartUploadResponse)
async def multipart_upload(
    file: UploadFile,
    http_request: Request,
    response: Response,
    subfolder: str | None = None,
) -> MultipartUploadResponse:
    """Upload a file via multipart form-data.

    Form fields:
        file: The file to upload.
        subfolder: Optional — "audio" or "video". Defaults to general uploads folder.
    """
    tags = ["uploads"]

    try:
        if not file.filename:
            raise HTTPException(status_code=400, detail="Missing filename")

        file_bytes = await file.read()
        if not file_bytes:
            raise HTTPException(status_code=400, detail="Empty file")

        upload_uuid = uuid.uuid4()
        _, ext = os.path.splitext(file.filename)
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

        content_type = file.content_type or get_content_type(file.filename)
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

        return MultipartUploadResponse(upload_id=result.id)

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="multipart_upload",
            request=http_request,
        )
        raise
