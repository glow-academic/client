"""Helper functions for creating dynamic child documents from template parents."""

import os
import uuid
from typing import Any

import asyncpg  # type: ignore
from fastapi import Request, Response

from app.api.v3.settings.active import (
    SettingsActiveRequest,
    ThemeTokens,
    get_active_settings,
)
from app.main import UPLOAD_FOLDER
from app.utils.jinja_renderer import render_template
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql

logger = get_logger(__name__)


async def create_dynamic_document(
    conn: asyncpg.Connection,
    parent_document_id: uuid.UUID,
    template_args: dict[str, Any],
    department_id: uuid.UUID | None = None,
    profile_id: uuid.UUID | None = None,
    http_request: Request | None = None,
) -> uuid.UUID:
    """Create a dynamic child document from a parent template document.

    Args:
        conn: Database connection
        parent_document_id: UUID of parent template document
        template_args: Dictionary of template arguments to fill in
        department_id: Optional department ID for theme
        profile_id: Optional profile ID for theme
        http_request: Optional HTTP request for theme settings

    Returns:
        UUID of created child document

    Raises:
        ValueError: If parent document not found or has no active template
    """
    # Get parent document template info
    sql_query = load_sql("sql/v3/documents/get_document_template_info.sql")
    template_row = await conn.fetchrow(sql_query, str(parent_document_id))

    if not template_row:
        raise ValueError(
            f"Parent document {parent_document_id} not found or has no active template"
        )

    file_path = template_row.get("file_path")
    if not file_path:
        raise ValueError(f"Parent document {parent_document_id} has no template file")

    # Read template HTML file
    full_template_path = os.path.join(UPLOAD_FOLDER, file_path)
    if not os.path.exists(full_template_path):
        raise ValueError(f"Template file not found at {file_path}")

    with open(full_template_path, encoding="utf-8") as f:
        template_html = f.read()

    # Get parent document info for inheritance
    parent_row = await conn.fetchrow(
        "SELECT classify_agent_id, document_agent_id, name, description FROM documents WHERE id = $1",
        parent_document_id,
    )
    if not parent_row:
        raise ValueError(f"Parent document {parent_document_id} not found")

    # Get theme tokens for rendering
    theme_tokens: ThemeTokens
    if http_request and profile_id:
        settings_request = SettingsActiveRequest(
            profileId=str(profile_id),
            departmentId=str(department_id) if department_id else None,
        )
        dummy_response = Response()
        settings_response = await get_active_settings(
            settings_request, http_request, dummy_response, conn
        )
        theme_tokens = settings_response.tokens
    else:
        # Use default theme tokens if no request/profile provided
        from app.api.v3.settings.active import ThemeTokens as ThemeTokensType

        theme_tokens = ThemeTokensType(
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

    # Merge template args with organization info if available
    merged_args = template_args.copy()
    if http_request and profile_id:
        settings_request = SettingsActiveRequest(
            profileId=str(profile_id),
            departmentId=str(department_id) if department_id else None,
        )
        dummy_response = Response()
        settings_response = await get_active_settings(
            settings_request, http_request, dummy_response, conn
        )

    # Render template HTML with Jinja
    rendered_html = render_template(
        html=template_html,
        context=merged_args,
        theme_tokens=theme_tokens,
    )

    # Create child document (not a template)
    child_document_id = uuid.uuid4()
    child_name = f"{parent_row['name']} (Dynamic)"
    child_description = parent_row.get("description") or ""

    sql_insert_document = load_sql("sql/v3/documents/insert_document_complete.sql")
    await conn.execute(
        sql_insert_document,
        str(child_document_id),
        child_name,
        child_description,
        False,  # classified
        True,  # active
        False,  # template (child is NOT a template)
        str(parent_row["classify_agent_id"]),
        str(parent_row["document_agent_id"]),
    )

    # Save rendered HTML as upload
    upload_uuid = uuid.uuid4()
    file_path = f"{upload_uuid}.html"
    full_path = os.path.join(UPLOAD_FOLDER, file_path)

    # Ensure uploads directory exists
    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

    # Write rendered HTML to file
    with open(full_path, "w", encoding="utf-8") as f:
        f.write(rendered_html)

    # Create upload record
    sql_insert_upload = load_sql("sql/v3/uploads/insert_upload.sql")
    upload_row = await conn.fetchrow(
        sql_insert_upload,
        file_path,
        "text/html",
        len(rendered_html.encode("utf-8")),
    )
    upload_id = upload_row["id"]

    # Link document to upload (regular upload, not template upload)
    sql_link_upload = load_sql("sql/v3/documents/insert_document_upload.sql")
    await conn.execute(
        sql_link_upload,
        str(child_document_id),
        str(upload_id),
        True,  # active
    )

    # Link parent→child in document_tree
    sql_link_tree = load_sql("sql/v3/documents/insert_document_tree.sql")
    await conn.execute(
        sql_link_tree,
        str(parent_document_id),
        str(child_document_id),
        True,  # active
    )

    logger.info(
        f"✓ Created dynamic child document {child_document_id} from parent {parent_document_id}"
    )

    return child_document_id
