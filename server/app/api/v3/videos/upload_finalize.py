"""Video upload finalize endpoint - v3 API following DHH principles."""

import json
import os
import shutil
import uuid
from typing import Annotated

import asyncpg  # type: ignore
from app.main import TUS_UPLOADS_DIR, UPLOAD_FOLDER, get_db
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Response
from pydantic import BaseModel

logger = get_logger(__name__)


# Inline request/response schemas
class UploadFinalizeRequest(BaseModel):
    """Request to finalize video upload."""

    uploadId: str
    fileId: str
    videoId: str
    name: str


class UploadFinalizeResponse(BaseModel):
    """Response from finalize upload."""

    success: bool
    message: str
    status: str
    videoId: str | None = None


router = APIRouter()


@router.post("/upload/finalize", response_model=UploadFinalizeResponse)
async def upload_finalize(
    request: UploadFinalizeRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadFinalizeResponse:
    """Finalize a video upload and update the video record with file_path and mime_type."""
    tags = ["videos"]  # From router tags

    try:
        video_id = uuid.UUID(request.videoId)

        # Find the upload directory
        upload_dir = None
        for dir_name in os.listdir(str(TUS_UPLOADS_DIR)):
            metadata_path = TUS_UPLOADS_DIR / dir_name / "metadata.json"
            if metadata_path.exists():
                with open(metadata_path) as f:
                    metadata = json.load(f)
                    if metadata.get("fileId") == request.fileId:
                        upload_dir = TUS_UPLOADS_DIR / dir_name
                        break

        if not upload_dir:
            return UploadFinalizeResponse(
                success=False,
                message=f"Upload with fileId {request.fileId} not found",
                status="error",
            )

        # Get the uploaded file path
        file_path = upload_dir / "file"

        # Check if file exists and has content
        if not file_path.exists() or file_path.stat().st_size == 0:
            return UploadFinalizeResponse(
                success=False,
                message="Upload file is missing or empty",
                status="error",
            )

        # Read metadata to get original filename and type
        metadata_path = upload_dir / "metadata.json"
        with open(metadata_path) as f:
            metadata = json.load(f)

        filename = metadata.get("filename", "unknown")
        _, ext = os.path.splitext(filename)
        # Default to .mp4 if no extension
        if not ext:
            ext = ".mp4"

        # Generate final filename: {video_id}_{uuid}{ext}
        # Store just the filename (relative to UPLOAD_FOLDER), consistent with images
        final_file_path = f"{video_id}_{uuid.uuid4()}{ext}"
        final_full_path = UPLOAD_FOLDER / final_file_path
        shutil.copy2(str(file_path), str(final_full_path))

        # Get mime type from metadata or infer from filename
        content_type = metadata.get("filetype") or get_content_type(filename)
        # Ensure it's a video mime type
        if not content_type.startswith("video/"):
            # Default to video/mp4 if we can't determine
            content_type = "video/mp4"

        # Update video record with file path and mime type
        sql_query = load_sql("sql/v3/videos/update_video_file_path.sql")
        await conn.execute(sql_query, str(video_id), final_file_path, content_type)

        logger.info(
            f"Video upload finalized: video_id={video_id}, file_path={final_file_path}, mime_type={content_type}"
        )

        # Clean up
        try:
            shutil.rmtree(str(upload_dir))
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        result_data = UploadFinalizeResponse(
            success=True,
            message="Video uploaded successfully",
            status="success",
            videoId=str(video_id),
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data

    except ValueError as e:
        logger.error(f"Invalid UUID or error: {str(e)}")
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        logger.error(f"Error finalizing upload: {str(e)}")
        return UploadFinalizeResponse(
            success=False,
            message=f"Failed to finalize upload: {str(e)}",
            status="error",
        )

