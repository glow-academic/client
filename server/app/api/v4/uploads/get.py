"""Upload download endpoint - v4 API following DHH principles."""

import os
import urllib.parse
import uuid
from typing import Annotated, Any, cast

import asyncpg  # type: ignore
from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse, Response, StreamingResponse

from app.infra.v4.activity.audit import audit_activity, audit_set
from app.infra.v4.error.handle_route_error import handle_route_error
from app.infra.v4.templates.jinja_renderer import render_template
from app.main import AUDIO_FOLDER, IMAGE_FOLDER, UPLOAD_FOLDER, get_db
from app.sql.types import (
    GetUploadFileInfoSqlParams,
    GetUploadFileInfoSqlRow,
    load_sql_query,
)
from app.utils.document.pdf_first_page_to_image_bytes import (
    pdf_first_page_to_image_bytes,
)
from app.utils.mime.get_content_type import get_content_type
from app.utils.settings.theme import ThemeTokens
from app.utils.sql_helper import execute_sql_typed

# Load SQL with types at module level - makes it clear what SQL file is used
SQL_PATH = "app/sql/v4/queries/uploads/get_upload_file_info_complete.sql"

router = APIRouter()


def create_range_streaming_response(
    file_path: str,
    content_type: str,
    range_header: str | None,
    content_disposition: str,
) -> Response:
    """Create a streaming response with HTTP Range support for video seeking.

    Args:
        file_path: Path to the file on disk
        content_type: MIME type of the file
        range_header: HTTP Range header value (e.g., "bytes=0-1023")
        content_disposition: Content-Disposition header value

    Returns:
        StreamingResponse with 206 Partial Content for range requests,
        or regular response for full file requests.
    """
    file_size = os.path.getsize(file_path)

    # Parse Range header if present
    start = 0
    end = file_size - 1

    if range_header:
        # Parse "bytes=start-end" format
        range_spec = range_header.replace("bytes=", "")
        if "-" in range_spec:
            parts = range_spec.split("-")
            if parts[0]:
                start = int(parts[0])
            if parts[1]:
                end = int(parts[1])

    # Ensure valid range
    if start >= file_size:
        start = 0
    if end >= file_size:
        end = file_size - 1

    content_length = end - start + 1
    chunk_size = 1024 * 1024  # 1MB chunks

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

    # Return 206 Partial Content for range requests, 200 for full file
    status_code = 206 if range_header else 200

    return StreamingResponse(
        iter_file(),
        status_code=status_code,
        media_type=content_type,
        headers=headers,
    )


@router.get(
    "/get/{upload_id}",
    response_model=None,
    dependencies=[
        audit_activity(
            "upload.downloaded", "{{ actor.name }} downloaded upload '{{ upload.id }}'"
        )
    ],
)
async def get_upload(
    upload_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
    preview: bool = Query(default=False, description="Return preview image for PDFs"),
) -> FileResponse | Response:
    """Download an upload by ID. If preview=True and file is PDF, returns first page as PNG."""
    sql_query = load_sql_query(SQL_PATH)
    sql_params: tuple[Any, ...] | None = None

    try:
        # Get profile_id from header (set by router-level dependency)
        profile_id = (
            http_request.state.profile_id
            if hasattr(http_request.state, "profile_id")
            else None
        )

        # Convert upload_id to UUID and prepare SQL params
        # Use double star pattern for parameter construction
        upload_id_uuid = uuid.UUID(upload_id)
        profile_id_uuid = (
            uuid.UUID(profile_id)
            if profile_id
            else uuid.UUID("00000000-0000-0000-0000-000000000000")
        )

        params = GetUploadFileInfoSqlParams(
            upload_id=upload_id_uuid,
            profile_id=profile_id_uuid,
        )
        sql_params = params.to_tuple()

        # Execute query with typed helper - automatically detects and calls function if present
        result = cast(
            GetUploadFileInfoSqlRow,
            await execute_sql_typed(
                conn,
                SQL_PATH,
                params=params,
            ),
        )

        # Check if upload exists
        if not result.upload_exists:
            raise HTTPException(status_code=404, detail="Upload not found")

        # Set audit context
        if result.actor_name and profile_id:
            audit_set(
                http_request,
                actor={"name": result.actor_name, "id": profile_id},
                upload={"id": upload_id},
            )

        # Handle subfolder paths (e.g., "audio/uuid.ext", "image/sc.png")
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

        # Handle preview mode for PDFs
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
            # If preview generation fails, fallback to original file

        # Handle template HTML processing
        is_html = content_type == "text/html" or (
            result.file_path or ""
        ).lower().endswith(".html")
        if is_html and result.is_template:
            # Template args are already returned from SQL function as JSONB
            # JSONB is automatically converted to dict by asyncpg, but we need to handle it properly
            template_args_raw: dict[str, Any] = {}
            if result.template_args:
                # asyncpg converts JSONB to dict, but type checker doesn't know this
                if isinstance(result.template_args, dict):
                    template_args_raw = result.template_args

                # Extract placeholder values from schema
                def extract_placeholders(
                    schema: dict[str, Any], path: list[str] = []
                ) -> dict[str, Any]:
                    """Extract placeholder values from schema to use as defaults."""
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

                # Get placeholder defaults from schema
                placeholder_defaults = extract_placeholders(template_args_raw)

                # Remove internal template keys
                def remove_template_keys(obj: Any) -> Any:
                    """Recursively remove keys that start with '_' and end with '_item_template'."""
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

                # Use default theme tokens (no profile/department needed)
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

                # Read template HTML file
                try:
                    with open(file_path, encoding="utf-8") as f:
                        template_html = f.read()

                    # Render template with placeholder defaults
                    rendered_html = render_template(
                        html=template_html,
                        context=merged_args,
                        theme_tokens=default_theme_tokens,
                    )

                    # Return rendered HTML
                    return Response(
                        content=rendered_html,
                        media_type="text/html",
                        headers={
                            "Cache-Control": "private, max-age=0, must-revalidate",
                        },
                    )
                except Exception:
                    # If template processing fails, fallback to original file
                    pass

        # Extract filename from file_path (remove directory if present)
        filename = os.path.basename(result.file_path or "")

        # Properly encode filename for HTTP headers
        encoded_filename = urllib.parse.quote(filename, safe="")
        content_disposition = f"inline; filename=\"{encoded_filename}\"; filename*=UTF-8''{encoded_filename}"

        # Use streaming with Range support for video files (enables seeking)
        if content_type.startswith("video/"):
            range_header = http_request.headers.get("range")
            return create_range_streaming_response(
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
            operation="get_upload",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise
