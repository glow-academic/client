"""Uploads entry CREATE endpoint — dual MCP/non-MCP interface.

MCP mode:    Accepts base64 string + metadata fields inline, writes file directly.
Normal mode: Creates entry record via generic entry function (TUS handles file upload separately).
"""

import base64
import os
import uuid as uuid_mod
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.main import AUDIO_FOLDER, UPLOAD_FOLDER, VIDEO_FOLDER, get_db
from app.sql.types import (
    CreateUploadsEntriesApiRequest,
    CreateUploadsEntriesApiResponse,
    CreateUploadsEntriesSqlParams,
    CreateUploadsEntriesSqlRow,
    FinalizeUploadSqlParams,
    FinalizeUploadSqlRow,
    load_sql_query,
)
from app.utils.cache.invalidate_tags import invalidate_tags
from app.utils.mime.get_content_type import get_content_type
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/uploads/create_uploads_entries_complete.sql"
FINALIZE_SQL_PATH = "app/sql/v4/queries/uploads/finalize_upload_complete.sql"

router = APIRouter()


# ============================================================================
# MCP mode: Accept base64 data + metadata, write file, create DB record
# ============================================================================


@router.post(
    "/uploads/create/mcp",
    response_model=CreateUploadsEntriesApiResponse,
    dependencies=[
        audit_activity(
            "uploads.created.mcp",
            "{{ actor.name }} created upload via MCP",
        )
    ],
)
async def create_uploads_entry_mcp(
    request: CreateUploadsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateUploadsEntriesApiResponse:
    """Create upload entry via MCP — accepts base64 file data inline.

    The request entry_data should include:
    - base64_data: base64-encoded file content
    - filename: original filename
    - mime_type: MIME type (optional, auto-detected from filename)
    - subfolder: 'audio' | 'video' | None (optional)
    """
    tags = ["entries", "uploads"]
    sql_query = load_sql_query(FINALIZE_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        request_dict = request.model_dump()
        entry_data = request_dict.get("entry_data", {}) or {}

        # Extract base64 data
        base64_data = entry_data.pop("base64_data", None)
        if not base64_data:
            raise HTTPException(
                status_code=400,
                detail="base64_data is required for MCP uploads",
            )

        # Decode file content
        try:
            file_bytes = base64.b64decode(base64_data)
        except Exception as e:
            raise HTTPException(
                status_code=400,
                detail=f"Invalid base64 data: {e}",
            ) from e

        filename = entry_data.get("filename", "unknown")
        subfolder = entry_data.get("subfolder")

        # Generate file path
        upload_uuid = uuid_mod.uuid4()
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

        # Write file
        with open(final_full_path, "wb") as f:
            f.write(file_bytes)

        content_type = entry_data.get("mime_type") or get_content_type(filename)
        file_size = len(file_bytes)

        profile_id_uuid = uuid_mod.UUID(profile_id)

        # Create DB record via finalize function
        params = FinalizeUploadSqlParams(
            upload_file_path=final_file_path,
            content_type=content_type,
            file_size=file_size,
            profile_id=profile_id_uuid,
        )
        sql_params = params.to_tuple()

        result = cast(
            FinalizeUploadSqlRow,
            await execute_sql_typed(conn, FINALIZE_SQL_PATH, params=params),
        )

        if not result or not result.upload_id:
            raise ValueError("Failed to create upload record")

        if result.actor_name:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                upload={"id": str(result.upload_id)},
            )

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return CreateUploadsEntriesApiResponse.model_validate(
            {"id": result.upload_id, "already_exists": False}
        )
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_uploads_entry_mcp",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )


# ============================================================================
# Non-MCP mode: Create entry record (TUS handles file upload separately)
# ============================================================================


@router.post(
    "/uploads/create",
    response_model=CreateUploadsEntriesApiResponse,
    dependencies=[
        audit_activity(
            "uploads.created",
            "{{ actor.name }} created uploads entry",
        )
    ],
)
async def create_uploads_entry(
    request: CreateUploadsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> CreateUploadsEntriesApiResponse:
    """Create uploads entry (non-MCP).

    For file uploads, use the TUS protocol endpoints:
    1. POST /uploads/upload — initiate TUS upload
    2. PATCH /uploads/upload/{id} — upload chunks
    3. POST /uploads/upload/{id}/finalize — finalize and create record
    """
    tags = ["entries", "uploads"]
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = http_request.state.profile_id
        if not profile_id:
            raise HTTPException(
                status_code=401,
                detail="Profile ID is required. Please sign in again.",
            )

        async with conn.transaction():
            mcp = getattr(http_request.state, "mcp", False) or False
            request_dict = request.model_dump()
            request_dict["mcp"] = mcp
            params = CreateUploadsEntriesSqlParams(**request_dict)
            sql_params = params.to_tuple()

            result = cast(
                CreateUploadsEntriesSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result or not result.id:
                raise ValueError("Failed to create uploads entry")

            audit_set(
                http_request,
                actor={"id": profile_id},
                uploads={"id": str(result.id)},
            )

        api_response = CreateUploadsEntriesApiResponse.model_validate(
            result.model_dump()
        )

        await invalidate_tags(tags)
        response.headers["X-Invalidate-Tags"] = ",".join(tags)

        return api_response
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="create_uploads_entry",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
