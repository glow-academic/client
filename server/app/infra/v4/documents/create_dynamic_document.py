"""Helper functions for creating dynamic child documents from template parents."""

import os
import uuid
from typing import Any, cast

import asyncpg  # type: ignore
from fastapi import Request
from utils.logging.db_logger import get_logger
from utils.settings.theme import (
    ThemePrimitives,
    ThemeTokens,
    derive_theme_tokens,
)
from utils.sql_helper import execute_sql_typed, load_sql

from app.infra.v4.templates.jinja_renderer import render_template
from app.main import UPLOAD_FOLDER
from app.sql.types import (
    GetActiveSettingsSqlParams,
    GetActiveSettingsSqlRow,
    InfrastructureDocumentsGetDocumentAgentsSqlParams,
    InfrastructureDocumentsGetDocumentAgentsSqlRow,
)

logger = get_logger(__name__)

ACTIVE_SETTINGS_SQL_PATH = "app/sql/v4/settings/get_active_settings_complete.sql"
GET_DOCUMENT_AGENTS_SQL_PATH = "app/sql/v4/infrastructure/documents/get_document_agents_complete.sql"


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
    sql_query = load_sql("app/sql/v4/documents/get_document_template_info.sql")
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
    params = InfrastructureDocumentsGetDocumentAgentsSqlParams(
        document_id=parent_document_id
    )
    parent_result = cast(
        InfrastructureDocumentsGetDocumentAgentsSqlRow,
        await execute_sql_typed(conn, GET_DOCUMENT_AGENTS_SQL_PATH, params=params),
    )
    if not parent_result:
        raise ValueError(f"Parent document {parent_document_id} not found")
    
    parent_row = {
        "classify_agent_id": parent_result.classify_agent_id,
        "document_agent_id": parent_result.document_agent_id,
        "name": parent_result.name,
        "description": parent_result.description,
    }

    # Get theme tokens for rendering
    theme_tokens: ThemeTokens
    if http_request and profile_id:
        # Get active settings directly via SQL function (cross-route independent)
        settings_params = GetActiveSettingsSqlParams(
            profile_id=str(profile_id),
            department_id=None,
        )
        settings_result = cast(
            GetActiveSettingsSqlRow,
            await execute_sql_typed(
                conn,
                ACTIVE_SETTINGS_SQL_PATH,
                params=settings_params,
            ),
        )

        if settings_result and settings_result.settings_id:
            # Extract theme primitives from SQL result and derive theme tokens
            theme_primitives = ThemePrimitives(
                primary=settings_result.primary_color or "",
                accent=settings_result.accent or "",
                background=settings_result.background or "",
                surface=settings_result.surface or "",
                success=settings_result.success or "",
                warning=settings_result.warning or "",
                error=settings_result.error or "",
                sidebarBackground=settings_result.sidebar_background or "",
                sidebarPrimary=settings_result.sidebar_primary or "",
                chart1=settings_result.chart1 or "",
                chart2=settings_result.chart2 or "",
                chart3=settings_result.chart3 or "",
                chart4=settings_result.chart4 or "",
                chart5=settings_result.chart5 or "",
            )
            theme_tokens = derive_theme_tokens(theme_primitives)
        else:
            # Fallback to default theme if no settings found
            theme_tokens = _get_default_theme_tokens()
    else:
        # Use default theme tokens if no request/profile provided
        theme_tokens = _get_default_theme_tokens()

    # Merge template args with organization info if available
    merged_args = template_args.copy()
    if http_request and profile_id:
        # Get settings again for organization info (if needed)
        settings_params = GetActiveSettingsSqlParams(
            profile_id=str(profile_id),
            department_id=None,
        )
        settings_result = cast(
            GetActiveSettingsSqlRow,
            await execute_sql_typed(
                conn,
                ACTIVE_SETTINGS_SQL_PATH,
                params=settings_params,
            ),
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

    sql_insert_document = load_sql("app/sql/v4/documents/insert_document_complete.sql")
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
    sql_insert_upload = load_sql("app/sql/v4/uploads/insert_upload.sql")
    upload_row = await conn.fetchrow(
        sql_insert_upload,
        file_path,
        "text/html",
        len(rendered_html.encode("utf-8")),
    )
    upload_id = upload_row["id"]

    # Link document to upload (regular upload, not template upload)
    sql_link_upload = load_sql("app/sql/v4/documents/insert_document_upload.sql")
    await conn.execute(
        sql_link_upload,
        str(child_document_id),
        str(upload_id),
        True,  # active
    )

    # Link parent→child in document_tree
    sql_link_tree = load_sql("app/sql/v4/documents/insert_document_tree.sql")
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


def _get_default_theme_tokens() -> ThemeTokens:
    """Get default theme tokens when no settings are available."""
    return ThemeTokens(
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
