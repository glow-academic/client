"""Uploads entry GET endpoint — dual MCP/non-MCP interface.

MCP mode:  Returns upload metadata from uploads_mv (file_path, mime_type, size, etc.)
Normal mode: Redirects to streaming download endpoint for file content
"""

import os
import urllib.parse
import uuid as uuid_mod
from typing import Annotated, Any, cast
from uuid import UUID

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Query, Request, Response
from fastapi.responses import FileResponse, StreamingResponse

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.infra.v4.templates.jinja_renderer import render_template
from app.main import AUDIO_FOLDER, IMAGE_FOLDER, UPLOAD_FOLDER, get_db
from app.sql.types import (
    GetUploadFileInfoSqlParams,
    GetUploadFileInfoSqlRow,
    GetUploadsEntriesApiRequest,
    GetUploadsEntriesApiResponse,
    GetUploadsEntriesSqlParams,
    GetUploadsEntriesSqlRow,
    load_sql_query,
)
from app.utils.cache.cache_key import cache_key
from app.utils.cache.get_cached import get_cached
from app.utils.cache.set_cached import set_cached
from app.utils.document.pdf_first_page_to_image_bytes import (
    pdf_first_page_to_image_bytes,
)
from app.utils.mime.get_content_type import get_content_type
from app.utils.settings.theme import ThemeTokens
from app.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/sql/v4/queries/entries/uploads/get_uploads_entries_complete.sql"
DOWNLOAD_SQL_PATH = "app/sql/v4/queries/uploads/get_upload_file_info_complete.sql"

router = APIRouter()


# ============================================================================
# MCP mode: Return metadata from uploads_mv
# ============================================================================


async def get_uploads_entries_internal(
    conn: asyncpg.Connection,
    ids: list[UUID],
    bypass_cache: bool = False,
) -> list[dict]:
    """Internal function to fetch uploads entries by IDs (metadata)."""
    if not ids:
        return []

    tags = ["entries", "uploads"]
    cache_key_val = cache_key(
        "/api/v4/entries/uploads/get",
        {"ids": [str(id) for id in ids]},
    )

    if not bypass_cache:
        cached = await get_cached(cache_key_val)
        if cached:
            return list(cached.get("items", []))

    params = GetUploadsEntriesSqlParams(ids=ids)
    result = cast(
        GetUploadsEntriesSqlRow,
        await execute_sql_typed(conn, SQL_PATH, params=params),
    )

    items: list[dict] = result.items if result and result.items else []

    await set_cached(
        cache_key_val,
        {"items": items if isinstance(items, list) else []},
        ttl=60,
        tags=tags,
    )

    return items


@router.post(
    "/uploads/get",
    response_model=GetUploadsEntriesApiResponse,
)
async def get_uploads_entries(
    request: GetUploadsEntriesApiRequest,
    http_request: Request,
    response: Response,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> GetUploadsEntriesApiResponse:
    """Get uploads entries by IDs.

    MCP mode: Returns upload metadata (file_path, mime_type, size, created_at).
    Normal mode: Also returns metadata (use /uploads/download/{id} for file content).
    """
    tags = ["entries", "uploads"]
    bypass_cache = http_request.headers.get("X-Bypass-Cache") == "1"

    try:
        items = await get_uploads_entries_internal(conn, request.ids, bypass_cache)
        response.headers["X-Cache-Tags"] = ",".join(tags)
        return GetUploadsEntriesApiResponse(items=items)
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e)) from e
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="get_uploads_entries",
            sql_query=load_sql_query(SQL_PATH),
            sql_params=None,
            request=http_request,
        )


# ============================================================================
# Non-MCP mode: Streaming download endpoint
# ============================================================================


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


@router.get(
    "/uploads/download/{upload_id}",
    response_model=None,
    dependencies=[
        audit_activity(
            "upload.downloaded",
            "{{ actor.name }} downloaded upload '{{ upload.id }}'",
        )
    ],
)
async def download_upload(
    upload_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    preview: bool = Query(default=False, description="Return preview image for PDFs"),
) -> FileResponse | Response:
    """Download an upload file by ID (non-MCP streaming endpoint)."""
    sql_query = load_sql_query(DOWNLOAD_SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        profile_id = (
            http_request.state.profile_id
            if hasattr(http_request.state, "profile_id")
            else None
        )

        upload_id_uuid = uuid_mod.UUID(upload_id)
        profile_id_uuid = (
            uuid_mod.UUID(profile_id)
            if profile_id
            else uuid_mod.UUID("00000000-0000-0000-0000-000000000000")
        )

        params = GetUploadFileInfoSqlParams(
            upload_id=upload_id_uuid,
            profile_id=profile_id_uuid,
        )
        sql_params = params.to_tuple()

        result = cast(
            GetUploadFileInfoSqlRow,
            await execute_sql_typed(conn, DOWNLOAD_SQL_PATH, params=params),
        )

        if not result.upload_exists:
            raise HTTPException(status_code=404, detail="Upload not found")

        if result.actor_name and profile_id:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                upload={"id": upload_id},
            )

        stored_path = result.file_path or ""
        if stored_path.startswith("audio/"):
            file_path = os.path.join(AUDIO_FOLDER, os.path.basename(stored_path))
        elif stored_path.startswith("image/"):
            file_path = os.path.join(IMAGE_FOLDER, os.path.basename(stored_path))
        else:
            file_path = os.path.join(UPLOAD_FOLDER, stored_path)

        if not os.path.exists(file_path):
            raise HTTPException(status_code=404, detail="Upload file not found")

        content_type = get_content_type(result.file_path or "", result.mime_type or "")

        if preview and content_type == "application/pdf":
            preview_bytes = pdf_first_page_to_image_bytes(file_path)
            if preview_bytes:
                return Response(
                    content=preview_bytes,
                    media_type="image/png",
                    headers={
                        "Cache-Control": "private, max-age=3600, must-revalidate",
                    },
                )

        is_html = content_type == "text/html" or (
            result.file_path or ""
        ).lower().endswith(".html")
        if is_html and result.is_template:
            template_args_raw: dict[str, Any] = {}
            if result.template_args:
                if isinstance(result.template_args, dict):
                    template_args_raw = result.template_args

                def extract_placeholders(
                    schema: dict[str, Any], path: list[str] = []
                ) -> dict[str, Any]:
                    defaults: dict[str, Any] = {}
                    if not isinstance(schema, dict) or "fields" not in schema:
                        return defaults
                    for field in schema.get("fields", []):
                        field_name = field.get("name")
                        if not field_name:
                            continue
                        current_path = path + [field_name]
                        placeholder = field.get("placeholder")
                        field_type = field.get("type")
                        if field_type == "array" and "item" in field:
                            item_field = field.get("item", {})
                            if isinstance(item_field, dict):
                                if (
                                    item_field.get("type") == "object"
                                    and "fields" in item_field
                                ):
                                    item_defaults = extract_placeholders(
                                        {"fields": item_field.get("fields", [])},
                                        current_path,
                                    )
                                    defaults[f"_{field_name}_item_template"] = (
                                        item_defaults
                                    )
                                elif item_field.get("type") == "string" and placeholder:
                                    defaults[f"_{field_name}_item_template"] = (
                                        placeholder
                                    )
                            defaults[field_name] = []
                        elif field_type == "object" and "fields" in field:
                            nested_defaults = extract_placeholders(
                                {"fields": field.get("fields", [])}, current_path
                            )
                            if nested_defaults:
                                defaults[field_name] = nested_defaults
                            elif placeholder:
                                defaults[field_name] = placeholder
                        elif placeholder:
                            defaults[field_name] = placeholder
                    return defaults

                placeholder_defaults = extract_placeholders(template_args_raw)

                def remove_template_keys(obj: Any) -> Any:
                    if isinstance(obj, dict):
                        cleaned = {}
                        for key, value in obj.items():
                            if not (
                                key.startswith("_") and key.endswith("_item_template")
                            ):
                                cleaned[key] = remove_template_keys(value)
                        return cleaned
                    elif isinstance(obj, list):
                        return [remove_template_keys(item) for item in obj]
                    else:
                        return obj

                merged_args = remove_template_keys(placeholder_defaults)

                default_theme_tokens = ThemeTokens(
                    primary="#000000",
                    primaryForeground="#ffffff",
                    background="#ffffff",
                    foreground="#000000",
                    card="#ffffff",
                    cardForeground="#000000",
                    popover="#ffffff",
                    popoverForeground="#000000",
                    secondary="#f3f4f6",
                    secondaryForeground="#000000",
                    muted="#f3f4f6",
                    mutedForeground="#6b7280",
                    accent="#f3f4f6",
                    accentForeground="#000000",
                    destructive="#ef4444",
                    border="#e5e7eb",
                    input="#ffffff",
                    ring="#000000",
                    success="#10b981",
                    successForeground="#ffffff",
                    warning="#f59e0b",
                    warningForeground="#ffffff",
                    info="#3b82f6",
                    infoForeground="#ffffff",
                    chart1="#8884d8",
                    chart2="#82ca9d",
                    chart3="#ffc658",
                    chart4="#ff7300",
                    chart5="#0088fe",
                    sidebar="#ffffff",
                    sidebarForeground="#000000",
                    sidebarPrimary="#000000",
                    sidebarPrimaryForeground="#ffffff",
                    sidebarAccent="#f3f4f6",
                    sidebarAccentForeground="#000000",
                    sidebarBorder="#e5e7eb",
                    sidebarRing="#000000",
                )

                try:
                    with open(file_path, encoding="utf-8") as f:
                        template_html = f.read()
                    rendered_html = render_template(
                        html=template_html,
                        context=merged_args,
                        theme_tokens=default_theme_tokens,
                    )
                    return Response(
                        content=rendered_html,
                        media_type="text/html",
                        headers={
                            "Cache-Control": "private, max-age=0, must-revalidate",
                        },
                    )
                except Exception:
                    pass

        filename = os.path.basename(result.file_path or "")
        encoded_filename = urllib.parse.quote(filename, safe="")
        content_disposition = f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"

        if content_type.startswith("video/"):
            range_header = http_request.headers.get("range")
            return _create_range_streaming_response(
                file_path=file_path,
                content_type=content_type,
                range_header=range_header,
                content_disposition=content_disposition,
            )

        return FileResponse(
            path=file_path,
            media_type=content_type,
            headers={
                "Content-Disposition": content_disposition,
                "Cache-Control": "private, max-age=0, must-revalidate",
            },
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="download_upload",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise
