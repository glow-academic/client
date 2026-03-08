"""TUS upload finalization — move file to permanent storage and create DB record."""

import json
import os
import shutil
import uuid
from typing import Annotated

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel

from app.infra.globals import (
    AUDIO_FOLDER,
    TUS_UPLOADS_DIR,
    UPLOAD_FOLDER,
    VIDEO_FOLDER,
    get_db,
    get_redis_client,
)
from app.routes.v5.tools.entries.uploads.create import create_upload
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.error.handle_route_error import handle_route_error
from app.utils.logging.db_logger import get_logger
from app.utils.mime.get_content_type import get_content_type

logger = get_logger(__name__)

router = APIRouter()


class FinalizeUploadResponse(BaseModel):
    upload_id: uuid.UUID


@router.post("/{upload_id}/finalize", response_model=FinalizeUploadResponse)
async def finalize_upload(
    upload_id: str,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FinalizeUploadResponse:
    """Finalize a TUS upload and create upload record."""
    tags = ["uploads"]

    try:
        upload_dir = TUS_UPLOADS_DIR / upload_id

        if not upload_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Upload with uploadId {upload_id} not found",
            )

        file_path = upload_dir / "file"

        if not file_path.exists() or file_path.stat().st_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Upload file is missing or empty",
            )

        metadata_path = upload_dir / "metadata.json"
        metadata = {}
        if metadata_path.exists():
            with open(metadata_path) as f:
                metadata = json.load(f)

        filename = metadata.get("filename", "unknown")
        file_size = file_path.stat().st_size
        subfolder = metadata.get("subfolder")

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

        shutil.copy2(str(file_path), str(final_full_path))

        content_type = metadata.get("filetype") or get_content_type(filename)

        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        session_id = http_request.state.session_id
        if not session_id:
            raise HTTPException(
                status_code=401,
                detail="Session ID is required.",
            )

        result = await create_upload(
            conn,
            session_id=uuid.UUID(session_id),
            file_path=final_file_path,
            mime_type=content_type,
            size=file_size,
        )

        try:
            shutil.rmtree(str(upload_dir))
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        await invalidate_tags(tags, redis=get_redis_client())
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return FinalizeUploadResponse(upload_id=result.id)

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="finalize_upload",
            request=http_request,
        )
