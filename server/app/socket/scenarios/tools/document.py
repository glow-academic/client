"""Handler for scenario_tool_document WebSocket event."""

import os
import uuid
from typing import Any

from app.api.v3.settings.active import ThemeTokens
from app.main import UPLOAD_FOLDER, get_pool, sio
from app.utils.jinja_renderer import render_template
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import load_sql
from pydantic import BaseModel, ValidationError

logger = get_logger(__name__)


class DocumentToolPayload(BaseModel):
    trace_id: str
    parent_document_id: str
    template_args: dict[str, Any]
    scenario_id: str | None = None
    department_id: str | None = None
    profile_id: str | None = None


class DocumentToolCompletePayload(BaseModel):
    success: bool
    document_id: str
    trace_id: str
    message: str | None = None


class DocumentToolErrorPayload(BaseModel):
    success: bool
    message: str
    trace_id: str


async def document_tool_complete(payload: DocumentToolCompletePayload, room: str) -> None:
    await sio.emit("scenario_tool_document_complete", payload.model_dump(), room=room)


async def document_tool_error(payload: DocumentToolErrorPayload, room: str) -> None:
    await sio.emit("scenario_tool_document_error", payload.model_dump(), room=room)


@sio.event  # type: ignore
async def scenario_tool_document(sid: str, data: dict[str, Any]) -> None:
    """Handle dynamic document creation event from scenario generation tool."""
    try:
        validated = DocumentToolPayload(**data)
    except ValidationError as e:
        logger.error(f"Validation error in scenario_tool_document for {sid}: {e}")
        await document_tool_error(
            DocumentToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
                trace_id=data.get("trace_id", "unknown"),
            ),
            room=sid,
        )
        return

    trace_id = validated.trace_id
    pool = get_pool()

    if not pool:
        await document_tool_error(
            DocumentToolErrorPayload(
                success=False,
                message="Database connection pool not available",
                trace_id=trace_id,
            ),
            room=sid,
        )
        return

    try:
        async with pool.acquire() as conn:
            parent_document_id = uuid.UUID(validated.parent_document_id)
            department_id = (
                uuid.UUID(validated.department_id) if validated.department_id else None
            )
            profile_id = uuid.UUID(validated.profile_id) if validated.profile_id else None

            # Get parent document template info
            sql_get_template = load_sql("sql/v3/documents/get_document_template_info.sql")
            template_row = await conn.fetchrow(sql_get_template, str(parent_document_id))

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

            # Get theme tokens for rendering (use defaults for WebSocket - no HTTP request)
            theme_tokens = ThemeTokens(
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

            # Render template HTML with Jinja
            rendered_html = render_template(
                html=template_html,
                context=validated.template_args,
                theme_tokens=theme_tokens,
            )

            # Create child document (not a template)
            child_document_id = uuid.uuid4()
            child_name = f"{parent_row['name']} (Dynamic)"
            child_description = parent_row.get("description") or ""

            # Insert document directly (DHH style - simple INSERT)
            await conn.execute(
                """
                INSERT INTO documents (
                    id, name, description, active, template, created_at, updated_at,
                    classify_agent_id, document_agent_id
                )
                VALUES ($1::uuid, $2, $3, true, false, NOW(), NOW(), $4::uuid, $5::uuid)
                """,
                str(child_document_id),
                child_name,
                child_description,
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

            # Optionally link to scenario if scenario_id provided
            if validated.scenario_id:
                scenario_id_uuid = uuid.UUID(validated.scenario_id)
                sql_link = load_sql("sql/v3/scenarios/insert_scenario_document_link.sql")
                await conn.execute(
                    sql_link,
                    str(scenario_id_uuid),
                    str(child_document_id),
                    True,  # active
                )
                logger.info(
                    f"✓ Linked document {child_document_id} to scenario {scenario_id_uuid}"
                )

            logger.info(
                f"✓ Created dynamic document {child_document_id} from parent {parent_document_id} "
                f"(scenario_id={validated.scenario_id}, trace_id={trace_id})"
            )

            await document_tool_complete(
                DocumentToolCompletePayload(
                    success=True,
                    document_id=str(child_document_id),
                    trace_id=trace_id,
                    message="Dynamic document created successfully",
                ),
                room=sid,
            )

    except Exception as e:
        logger.error(f"Error in scenario_tool_document for {sid}: {str(e)}", exc_info=True)
        await document_tool_error(
            DocumentToolErrorPayload(success=False, message=str(e), trace_id=trace_id),
            room=sid,
        )

