"""TUS upload finalization — move file to permanent storage and create DB record."""

import json
import os
import shutil
import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import AUDIO_FOLDER, TUS_UPLOADS_DIR, UPLOAD_FOLDER, VIDEO_FOLDER, get_db
from app.sql.types import (
    FinalizeUploadApiResponse,
    FinalizeUploadSqlParams,
    FinalizeUploadSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.logging.db_logger import get_logger
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/uploads/finalize_upload_complete.sql"

logger = get_logger(__name__)

router = APIRouter()


@router.post(
    "/{upload_id}/finalize",
    response_model=FinalizeUploadApiResponse,
    dependencies=[
        audit_activity(
            "upload.finalized", "{{ actor.name }} finalized upload '{{ upload.id }}'"
        )
    ],
)
async def finalize_upload(
    upload_id: str,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> FinalizeUploadApiResponse:
    """Finalize a TUS upload and create upload record."""
    tags = ["uploads"]
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

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

        profile_id_uuid = uuid.UUID(profile_id)

        sql_query = load_sql_query(SQL_PATH)
        params = FinalizeUploadSqlParams(
            upload_file_path=final_file_path,
            content_type=content_type,
            file_size=file_size,
            profile_id=profile_id_uuid,
        )
        sql_params = params.to_tuple()

        sql_result = cast(
            FinalizeUploadSqlRow,
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not sql_result or not sql_result.upload_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create upload record",
            )

        try:
            shutil.rmtree(str(upload_dir))
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        if sql_result.actor_name:
            audit_set(
                http_request,
                actor={"name": sql_result.actor_name, "id": profile_id},
                upload={"id": str(sql_result.upload_id)},
            )

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        api_response = FinalizeUploadApiResponse.model_validate(sql_result.model_dump())
        return api_response

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="finalize_upload",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
