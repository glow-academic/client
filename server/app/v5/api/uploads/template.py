"""Upload HTML template rendering."""

import os
import uuid as uuid_mod
from typing import Annotated, Any, cast

import asyncpg
from fastapi import APIRouter, Depends, HTTPException, Request, Response

from app.v5.infra.error.handle_route_error import handle_route_error
from app.v5.infra.templates.jinja_renderer import render_template
from app.main import AUDIO_FOLDER, IMAGE_FOLDER, UPLOAD_FOLDER, get_db
from app.v5.sql.types import (
    GetUploadFileInfoSqlParams,
    GetUploadFileInfoSqlRow,
    load_sql_query,
)
from app.v5.utils.mime.get_content_type import get_content_type
from app.v5.utils.settings.theme import ThemeTokens
from app.v5.utils.sql_helper import execute_sql_typed

SQL_PATH = "app/v5/sql/queries/uploads/get_upload_file_info_complete.sql"

router = APIRouter()


@router.get("/{upload_id}/template", response_model=None)
async def render_upload_template(
    upload_id: str,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> Response:
    """Render an HTML upload as a template with placeholder defaults."""
    sql_query = load_sql_query(SQL_PATH)
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
            await execute_sql_typed(conn, SQL_PATH, params=params),
        )

        if not result.upload_exists:
            raise HTTPException(status_code=404, detail="Upload not found")

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

        is_html = content_type == "text/html" or (
            result.file_path or ""
        ).lower().endswith(".html")
        if not is_html:
            raise HTTPException(
                status_code=400,
                detail="Template rendering only supported for HTML files",
            )

        template_args_raw: dict[str, Any] = {}
        if hasattr(result, "template_args") and result.template_args:
            if isinstance(result.template_args, dict):
                template_args_raw = result.template_args

        def extract_placeholders(
            schema: dict[str, Any], path: list[str] | None = None
        ) -> dict[str, Any]:
            if path is None:
                path = []
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
                            defaults[f"_{field_name}_item_template"] = item_defaults
                        elif item_field.get("type") == "string" and placeholder:
                            defaults[f"_{field_name}_item_template"] = placeholder
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
                    if not (key.startswith("_") and key.endswith("_item_template")):
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
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="render_upload_template",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise
