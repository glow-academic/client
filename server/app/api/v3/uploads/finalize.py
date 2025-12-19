"""TUS finalize endpoint - v3 API following DHH principles."""

import json
import os
import shutil
import uuid
from typing import Annotated

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, Request, Response
from pydantic import BaseModel

from app.main import AUDIO_FOLDER, TUS_UPLOADS_DIR, UPLOAD_FOLDER, VIDEO_FOLDER, get_db
from app.utils.activity.audit import audit_activity, audit_set
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


# Inline request/response schemas
class TusFinalizeResponse(BaseModel):
    """Response from finalize upload."""

    success: bool
    message: str
    status: str
    uploadId: str | None = None  # Database upload UUID


router = APIRouter()


@router.post(
    "/upload/{upload_id}/finalize",
    response_model=TusFinalizeResponse,
    dependencies=[
        audit_activity(
            "upload.finalized", "{{ actor.name }} finalized upload '{{ upload.id }}'"
        )
    ],
)
async def tus_finalize(
    upload_id: str,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> TusFinalizeResponse:
    """Finalize a TUS upload and create upload record."""
    tags = ["uploads"]

    try:
        # Find the upload directory
        upload_dir = TUS_UPLOADS_DIR / upload_id

        if not upload_dir.exists():
            return TusFinalizeResponse(
                success=False,
                message=f"Upload with uploadId {upload_id} not found",
                status="error",
            )

        # Get the uploaded file path
        file_path = upload_dir / "file"

        # Check if file exists and has content
        if not file_path.exists() or file_path.stat().st_size == 0:
            return TusFinalizeResponse(
                success=False,
                message="Upload file is missing or empty",
                status="error",
            )

        # Read metadata
        metadata_path = upload_dir / "metadata.json"
        metadata = {}
        if metadata_path.exists():
            with open(metadata_path) as f:
                metadata = json.load(f)

        filename = metadata.get("filename", "unknown")
        file_size = file_path.stat().st_size

        # Check if subfolder is specified in metadata
        subfolder = metadata.get("subfolder")

        # Generate final file path with UUID
        upload_uuid = uuid.uuid4()
        _, ext = os.path.splitext(filename)
        if not ext:
            ext = ".bin"

        # Determine target folder and file path
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

        # Move file from TUS directory to final location
        shutil.copy2(str(file_path), str(final_full_path))

        content_type = metadata.get("filetype") or get_content_type(filename)

        # Insert upload record (SQL returns the generated ID)
        sql = load_sql("sql/v3/uploads/insert_upload.sql")
        upload_id = await conn.fetchval(
            sql,
            final_file_path,
            content_type,
            file_size,
        )

        if not upload_id:
            return TusFinalizeResponse(
                success=False,
                message="Failed to create upload record",
                status="error",
            )

        # Clean up TUS upload directory
        try:
            shutil.rmtree(str(upload_dir))
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        result_data = TusFinalizeResponse(
            success=True,
            message="Upload finalized successfully",
            status="success",
            uploadId=upload_id,
        )

        # Fetch actor_name separately
        profile_id = (
            http_request.state.profile_id
            if hasattr(http_request.state, "profile_id")
            else None
        )
        actor_name_row = None
        if profile_id:
            actor_name_row = await conn.fetchrow(
                "SELECT first_name || ' ' || last_name as actor_name FROM profiles WHERE id = $1",
                profile_id,
            )
        actor_name = actor_name_row["actor_name"] if actor_name_row else None

        # Set audit context
        if actor_name:
            audit_set(
                http_request,
                actor={"name": actor_name, "id": profile_id},
                upload={"id": str(upload_id)},
            )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return result_data

    except Exception as e:
        logger.error(f"Error finalizing upload: {str(e)}")
        return TusFinalizeResponse(
            success=False,
            message=f"Failed to finalize upload: {str(e)}",
            status="error",
        )
