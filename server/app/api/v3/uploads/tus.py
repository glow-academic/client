"""TUS protocol endpoints - v3 API following DHH principles."""

import base64
import json
import os
import shutil
import uuid
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from utils.cache.invalidate_tags import invalidate_tags
from utils.logging.db_logger import get_logger
from utils.mime.get_content_type import get_content_type
from utils.sql_helper import execute_sql_typed

from app.infra.v3.activity.audit import audit_activity, audit_set
from app.infra.v3.error.handle_route_error import handle_route_error
from app.main import AUDIO_FOLDER, TUS_UPLOADS_DIR, UPLOAD_FOLDER, VIDEO_FOLDER, get_db
from app.sql.types import (
    FinalizeUploadApiResponse,
    FinalizeUploadSqlParams,
    FinalizeUploadSqlRow,
    load_sql_query,
)

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v3/uploads/finalize_upload_complete.sql"

logger = get_logger(__name__)

router = APIRouter()


@router.options("/upload")
async def tus_options(request: Request) -> Response:
    """Handle OPTIONS request for tus protocol discovery."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Tus-Extension": "creation,termination,creation-with-upload",
            "Tus-Max-Size": "1073741824",  # 1GB max file size
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.options("/upload/{upload_id}")
async def tus_options_upload_id(upload_id: str, request: Request) -> Response:
    """Handle OPTIONS request for specific upload."""
    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Tus-Version": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "POST, HEAD, PATCH, OPTIONS",
            "Access-Control-Allow-Headers": "Tus-Resumable, Upload-Length, Upload-Metadata, Upload-Offset, Content-Type",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            "Access-Control-Max-Age": "86400",
        }
    )


@router.post(
    "/upload",
    dependencies=[audit_activity("upload.uploaded", "{{ actor.name }} uploaded file")],
)
async def tus_creation(request: Request) -> Response:
    """Handle POST request for tus protocol - create upload."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Get upload length
    upload_length = request.headers.get("Upload-Length")
    if not upload_length:
        return Response(status_code=400, content="Missing Upload-Length header")

    # Parse metadata
    metadata = {}
    if "Upload-Metadata" in request.headers:
        for kv in request.headers["Upload-Metadata"].split(","):
            if " " in kv:
                k, v = kv.strip().split(" ", 1)
                metadata[k] = base64.b64decode(v).decode("utf-8")

    # Get app prefix from environment
    app_prefix = os.getenv("APP_PREFIX", "").strip("/")

    # Create upload directory and files
    upload_id = str(uuid.uuid4())
    upload_dir = TUS_UPLOADS_DIR / upload_id
    upload_dir.mkdir(parents=True, exist_ok=True)

    # Save metadata
    with open(upload_dir / "metadata.json", "w") as f:
        json.dump(metadata, f)

    # Create empty file
    with open(upload_dir / "file", "wb") as f:
        pass

    # Save upload info
    with open(upload_dir / "info", "w") as f:
        f.write(f"length:{upload_length}\noffset:0")

    # Generate location path
    if app_prefix:
        location = f"/{app_prefix}/api/v3/uploads/upload/{upload_id}"
    else:
        location = f"/api/v3/uploads/upload/{upload_id}"

    # Set audit context if profile_id is available
    profile_id = (
        getattr(request.state, "profile_id", None)
        if hasattr(request.state, "profile_id")
        else None
    )
    if profile_id:
        # Note: We can't fetch actor_name here without database access
        # Activity logging will use profile_id only
        audit_set(request, actor={"id": profile_id}, upload={"id": upload_id})

    # Handle creation-with-upload if Content-Length > 0
    if request.headers.get("Content-Length", "0") != "0":
        chunk = await request.body()

        # Read current info
        info = {}
        with open(upload_dir / "info") as f:
            for line in f:
                k, v = line.strip().split(":", 1)
                info[k] = v

        # Append chunk to file
        with open(upload_dir / "file", "ab") as f:
            f.write(chunk)

        # Update offset
        new_offset = int(info.get("offset", "0")) + len(chunk)
        with open(upload_dir / "info", "w") as f:
            f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

        return Response(
            status_code=201,
            headers={
                "Location": location,
                "Tus-Resumable": "1.0.0",
                "Upload-Offset": str(new_offset),
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
            },
        )

    return Response(
        status_code=201,
        headers={
            "Location": location,
            "Tus-Resumable": "1.0.0",
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        },
    )


@router.head("/upload/{upload_id}")
async def tus_head(upload_id: str, request: Request) -> Response:
    """Handle HEAD request for tus protocol - get upload info."""
    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    # Read info file
    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    headers = {
        "Tus-Resumable": "1.0.0",
        "Upload-Offset": info.get("offset", "0"),
        "Upload-Length": info.get("length", "0"),
        "Cache-Control": "no-store",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
    }

    return Response(headers=headers)


@router.patch(
    "/upload/{upload_id}",
    dependencies=[
        audit_activity(
            "upload.patched", "{{ actor.name }} patched upload '{{ upload.id }}'"
        )
    ],
)
async def tus_patch(upload_id: str, request: Request) -> Response:
    """Handle PATCH request for tus protocol - upload chunk."""
    # Check tus version
    if request.headers.get("Tus-Resumable") != "1.0.0":
        return Response(status_code=412, headers={"Tus-Version": "1.0.0"})

    # Check content type
    if request.headers.get("Content-Type") != "application/offset+octet-stream":
        return Response(status_code=415)

    # Get expected offset
    expected_offset = request.headers.get("Upload-Offset")
    if not expected_offset:
        return Response(status_code=400, content="Missing Upload-Offset header")

    # Read chunk
    chunk = await request.body()

    upload_dir = TUS_UPLOADS_DIR / upload_id

    if not upload_dir.exists():
        return Response(status_code=404)

    # Read info file
    info = {}
    with open(upload_dir / "info") as f:
        for line in f:
            k, v = line.strip().split(":", 1)
            info[k] = v

    # Check offset
    if expected_offset != info.get("offset"):
        return Response(status_code=409)

    # Append to file
    with open(upload_dir / "file", "ab") as f:
        f.write(chunk)

    # Update offset
    new_offset = int(info.get("offset", "0")) + len(chunk)
    with open(upload_dir / "info", "w") as f:
        f.write(f"length:{info.get('length', '0')}\noffset:{new_offset}")

    # Set audit context if profile_id is available
    profile_id = (
        getattr(request.state, "profile_id", None)
        if hasattr(request.state, "profile_id")
        else None
    )
    if profile_id:
        # Note: We can't fetch actor_name here without database access
        # Activity logging will use profile_id only
        audit_set(request, actor={"id": profile_id}, upload={"id": upload_id})

    return Response(
        headers={
            "Tus-Resumable": "1.0.0",
            "Upload-Offset": str(new_offset),
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Expose-Headers": "Tus-Resumable, Upload-Offset, Upload-Length, Location",
        }
    )


@router.post(
    "/upload/{upload_id}/finalize",
    response_model=FinalizeUploadApiResponse,
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
) -> FinalizeUploadApiResponse:
    """Finalize a TUS upload and create upload record."""
    tags = ["uploads"]
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Find the upload directory
        upload_dir = TUS_UPLOADS_DIR / upload_id

        if not upload_dir.exists():
            raise HTTPException(
                status_code=404,
                detail=f"Upload with uploadId {upload_id} not found",
            )

        # Get the uploaded file path
        file_path = upload_dir / "file"

        # Check if file exists and has content
        if not file_path.exists() or file_path.stat().st_size == 0:
            raise HTTPException(
                status_code=400,
                detail="Upload file is missing or empty",
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

        # Get profile_id from header (set by router-level dependency)
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        # Convert to UUID for SQL function
        profile_id_uuid = uuid.UUID(profile_id)

        # Prepare SQL params
        sql_query = load_sql_query(SQL_PATH)
        params = FinalizeUploadSqlParams(
            upload_file_path=final_file_path,
            content_type=content_type,
            file_size=file_size,
            profile_id=profile_id_uuid,
        )
        sql_params = params.to_tuple()

        # Execute SQL with typed helper - automatically detects and calls function if present
        sql_result = cast(
            FinalizeUploadSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        if not sql_result or not sql_result.upload_id:
            raise HTTPException(
                status_code=500,
                detail="Failed to create upload record",
            )

        # Clean up TUS upload directory
        try:
            shutil.rmtree(str(upload_dir))
        except Exception as e:
            logger.warning(f"Failed to clean up upload directory: {str(e)}")

        # Set audit context using actor_name from SQL result
        if sql_result.actor_name:
            audit_set(
                http_request,
                actor={"name": sql_result.actor_name, "id": profile_id},
                upload={"id": str(sql_result.upload_id)},
            )

        # Invalidate cache after mutation
        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        # Build response - SQL function returns upload_id, actor_name, success, message, status
        api_response = FinalizeUploadApiResponse.model_validate(sql_result.model_dump())
        return api_response

    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="tus_finalize",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
