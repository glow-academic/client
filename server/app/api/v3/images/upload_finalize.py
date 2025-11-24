"""Image upload finalize endpoint - v3 API following DHH principles."""

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
from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel

logger = get_logger(__name__)


# Inline request/response schemas
class UploadFinalizeRequest(BaseModel):
    """Request to finalize image upload."""

    uploadId: str
    fileId: str
    name: str


class UploadFinalizeResponse(BaseModel):
    """Response from finalize upload."""

    success: bool
    message: str
    status: str
    imageId: str | None = None


router = APIRouter()


@router.post("/upload/finalize", response_model=UploadFinalizeResponse)
async def upload_finalize(
    request: UploadFinalizeRequest,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> UploadFinalizeResponse:
    """Finalize an image upload and create the image."""
    tags = ["images"]  # From router tags

    try:
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

        # Handle regular image upload
        image_id = uuid.uuid4()

        metadata_path = upload_dir / "metadata.json"
        with open(metadata_path) as f:
            metadata = json.load(f)

        filename = metadata.get("filename", "unknown")
        _, ext = os.path.splitext(filename)
        if not ext:
            ext = ".bin"

        final_file_path = f"{image_id}{ext}"
        final_full_path = UPLOAD_FOLDER / final_file_path
        shutil.copy2(str(file_path), str(final_full_path))

        content_type = metadata.get("filetype") or get_content_type(filename)

        # Insert image (single query)
        sql = load_sql("sql/v3/images/insert_image_complete.sql")
        await conn.execute(
            sql,
            image_id,
            request.name,
            final_file_path,
            content_type,
        )

        # Clean up
        try:
            shutil.rmtree(str(upload_dir))
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        result_data = UploadFinalizeResponse(
            success=True,
            message="Image uploaded successfully",
            status="success",
            imageId=str(image_id),
        )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data

    except Exception as e:
        logger.error(f"Error finalizing upload: {str(e)}")
        return UploadFinalizeResponse(
            success=False,
            message=f"Failed to finalize upload: {str(e)}",
            status="error",
        )

