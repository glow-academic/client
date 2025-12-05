"""Document template rendering endpoint - v3 API following DHH principles."""

import json
import os
import uuid
from typing import Annotated, Any

import asyncpg  # type: ignore
from app.api.v3.settings.active import (
    SettingsActiveRequest,
    SettingsActiveResponse,
    derive_theme_tokens,
    get_active_settings,
)
from app.main import UPLOAD_FOLDER, get_db
from app.utils.error.handle_route_error import handle_route_error
from app.utils.jinja_renderer import render_template
from app.utils.sql_helper import load_sql
from fastapi import APIRouter, Depends, HTTPException, Request, Response
from pydantic import BaseModel


class RenderTemplateRequest(BaseModel):
    """Request to render document template."""

    documentId: str
    templateArgs: dict[str, Any]
    profileId: str


class RenderTemplateResponse(BaseModel):
    """Response from template rendering."""

    success: bool
    message: str
    rendered_html: str


router = APIRouter()


@router.post("/render", response_model=RenderTemplateResponse)
async def render_document_template(
    request: RenderTemplateRequest,
    http_request: Request,
    conn: Annotated[asyncpg.Connection, Depends(get_db)],
) -> RenderTemplateResponse:
    """Render Jinja2 template with template args and theme injection."""
    sql_query: str | None = None
    sql_params: tuple[Any, ...] | None = None

    try:
        # Convert string ID to UUID
        document_id = uuid.UUID(request.documentId)
        profile_id = uuid.UUID(request.profileId)

        # Get template upload info and template args
        # SQL uses INNER JOIN so it only returns rows if document exists and has active template
        sql_query = load_sql("sql/v3/documents/render_template_complete.sql")
        sql_params = (str(document_id),)
        template_row = await conn.fetchrow(sql_query, *sql_params)

        if not template_row:
            raise HTTPException(
                status_code=404,
                detail=f"Document {request.documentId} not found or has no active template",
            )

        file_path = template_row.get("file_path")
        if not file_path:
            raise HTTPException(
                status_code=404,
                detail="Template upload file not found",
            )

        # Read template HTML file
        full_path = os.path.join(UPLOAD_FOLDER, file_path)
        if not os.path.exists(full_path):
            raise HTTPException(
                status_code=404,
                detail=f"Template file not found at {file_path}",
            )

        with open(full_path, encoding="utf-8") as f:
            template_html = f.read()

        # Get active theme
        settings_request = SettingsActiveRequest(profileId=request.profileId)
        # Create a dummy response object for get_active_settings
        dummy_response = Response()
        settings_response = await get_active_settings(
            settings_request, http_request, dummy_response, conn
        )
        theme_tokens = settings_response.tokens

        # Merge template_args from document with request templateArgs
        # Request args override document args
        document_template_args = template_row.get("template_args") or {}
        if isinstance(document_template_args, str):
            document_template_args = json.loads(document_template_args)

        # Merge: request args override document args
        merged_args = {**document_template_args, **request.templateArgs}

        # Render template
        rendered_html = render_template(
            html=template_html,
            context=merged_args,
            theme_tokens=theme_tokens,
        )

        return RenderTemplateResponse(
            success=True,
            message="Template rendered successfully",
            rendered_html=rendered_html,
        )
    except HTTPException:
        raise
    except Exception as e:
        handle_route_error(
            error=e,
            route_path=http_request.url.path,
            operation="render_template",
            sql_query=sql_query,
            sql_params=sql_params,
            request=http_request,
        )
        raise HTTPException(
            status_code=500,
            detail=f"Failed to render template: {str(e)}",
        )

