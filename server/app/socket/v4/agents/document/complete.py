"""Handler for document_complete WebSocket event - dispatches to tool-specific handlers by tool_type."""

import json
import os
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import UPLOAD_FOLDER, get_internal_sio, sio
from app.utils.schema_helper import create_schema_from_dict
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

server_router = APIRouter()

# Types will be auto-generated from SQL introspection
try:
    from app.sql.types import (
        CreateTemplateAndLinkSqlParams,
        CreateTemplateAndLinkSqlRow,
        GetDocumentTemplatesSqlParams,
        GetDocumentTemplatesSqlRow,
    )
except ImportError:
    from pydantic import BaseModel

    class CreateTemplateAndLinkSqlParams(BaseModel):
        document_id: uuid.UUID
        upload_id: uuid.UUID
        name: str
        schema_id: uuid.UUID
        active: bool
        run_id: uuid.UUID

    class CreateTemplateAndLinkSqlRow(BaseModel):
        template_id: uuid.UUID

    class GetDocumentTemplatesSqlParams(BaseModel):
        document_id: uuid.UUID

    class GetDocumentTemplatesSqlRow(BaseModel):
        templates: list[Any] | None = None


SQL_CREATE_TEMPLATE_PATH = "app/sql/v4/documents/create_template_and_link_complete.sql"

# Map tool_type enum to event name (stable mapping based on enum)
TOOL_TYPE_COMPLETE_EVENT_MAP = {
    "title": "document_tool_title_complete",
    "html": "document_tool_html_complete",
    "schema": "document_tool_schema_complete",
}


async def _document_complete_impl(
    sid: str,
    data: dict[str, Any],  # Will use auto-generated type when available
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler by tool_type."""
    if data.get("type") == "tool_call_complete":
        # Get tool_type from data (should be passed from generate.py)
        tool_type = data.get("tool_type")

        if not tool_type:
            # Fallback: try to get from tool_name (for backward compatibility during migration)
            tool_name = data.get("tool_name")
            if tool_name == "create_title":
                tool_type = "title"
            elif tool_name == "generate_html":
                tool_type = "html"
            elif tool_name == "generate_schema":
                tool_type = "schema"

        # Route based on tool_type (stable enum)
        tool_event_name = (
            TOOL_TYPE_COMPLETE_EVENT_MAP.get(tool_type) if tool_type else None
        )

        if tool_event_name:
            await internal_sio.emit(
                tool_event_name,
                {
                    "sid": data.get("sid"),
                    "document_id": data.get("document_id"),
                    "run_id": data.get("run_id"),
                    "tool_call_id": data.get("tool_call_id") or "",
                    "call_id": data.get("call_id"),
                },
            )
        else:
            await internal_sio.emit(
                "document_error",
                {
                    "sid": data.get("sid"),
                    "success": False,
                    "message": f"Unknown tool_type for completion: {tool_type}",
                },
            )

    elif data.get("type") == "run_complete":
        # All tools done - extract results and create templates
        document_id_str = data.get("document_id")
        run_id_str = data.get("run_id")
        group_id_str = data.get("group_id")
        department_id_str = data.get("department_id")
        document_name = data.get("document_name")

        if not run_id_str:
            await internal_sio.emit(
                "document_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Missing run_id in run_complete event",
                },
            )
            return

        try:
            async with get_db_connection() as conn:
                model_run_id = uuid.UUID(run_id_str)
                document_id = uuid.UUID(document_id_str) if document_id_str else None

                # Extract results from SQL (tool_call_arguments table)
                template_html = ""
                template_schema_str = "{}"

                # Get template_html from generate_html tool_call
                html_tool_call_query = """
                    SELECT tca.arguments_json->>'template_html' as template_html
                    FROM tool_calls tc
                    JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
                    JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
                    JOIN tools t ON t.id = tc.tool_id
                    WHERE tcr.run_id = $1
                      AND t.name = 'generate_html'
                      AND tc.completed = true
                    ORDER BY tc.created_at DESC
                    LIMIT 1
                """
                html_result = await conn.fetchrow(html_tool_call_query, model_run_id)
                if html_result and html_result["template_html"]:
                    template_html = html_result["template_html"]

                # Get schema_json from generate_schema tool_call
                schema_tool_call_query = """
                    SELECT tca.arguments_json->>'schema_json' as schema_json
                    FROM tool_calls tc
                    JOIN tool_call_runs tcr ON tcr.tool_call_id = tc.id
                    JOIN tool_call_arguments tca ON tca.tool_call_id = tc.id
                    JOIN tools t ON t.id = tc.tool_id
                    WHERE tcr.run_id = $1
                      AND t.name = 'generate_schema'
                      AND tc.completed = true
                    ORDER BY tc.created_at DESC
                    LIMIT 1
                """
                schema_result = await conn.fetchrow(
                    schema_tool_call_query, model_run_id
                )
                if schema_result and schema_result["schema_json"]:
                    template_schema_str = schema_result["schema_json"]

                # Parse schema JSON
                try:
                    template_schema = json.loads(template_schema_str)
                except (json.JSONDecodeError, TypeError):
                    template_schema = {}

                # Verify both tools were called and have results
                if (
                    not template_html
                    or not template_schema_str
                    or template_schema_str == "{}"
                ):
                    await internal_sio.emit(
                        "document_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": (
                                "Document agent did not call both required tools or tools returned empty results. "
                                "Expected: generate_html and generate_schema"
                            ),
                        },
                    )
                    return

                # Create template file and link to document
                template_mapping: dict[str, Any] | None = None

                try:
                    # Save template HTML to file and create upload record
                    upload_uuid = uuid.uuid4()
                    file_path = f"{upload_uuid}.html"
                    full_path = os.path.join(UPLOAD_FOLDER, file_path)

                    # Ensure uploads directory exists
                    os.makedirs(UPLOAD_FOLDER, exist_ok=True)

                    # Write template HTML to file
                    with open(full_path, "w", encoding="utf-8") as f:
                        f.write(template_html)

                    async with conn.transaction():
                        # Create upload record
                        sql_insert_upload = load_sql(
                            "app/sql/v4/uploads/insert_upload.sql"
                        )
                        upload_id_result = await conn.fetchrow(
                            sql_insert_upload,
                            file_path,
                            "text/html",
                            len(template_html.encode("utf-8")),
                        )
                        upload_id = upload_id_result["id"]

                        # If documentId is provided, create template and link to document and run
                        if document_id:
                            template_name = (
                                f"Template for {document_name or 'Document'}"
                            )

                            # Create schema records from template_schema dict
                            schema_id = await create_schema_from_dict(
                                conn, template_schema
                            )

                            # Create template and link to document and run using execute_sql_typed()
                            create_template_params = CreateTemplateAndLinkSqlParams(
                                document_id=document_id,
                                upload_id=uuid.UUID(upload_id),
                                name=template_name,
                                schema_id=schema_id,
                                active=True,
                                run_id=model_run_id,
                            )
                            template_result = cast(
                                CreateTemplateAndLinkSqlRow,
                                await execute_sql_typed(
                                    conn,
                                    SQL_CREATE_TEMPLATE_PATH,
                                    params=create_template_params,
                                ),
                            )

                            if template_result:
                                template_id = template_result.template_id

                            # Fetch updated templates and build mapping from array
                            template_params = GetDocumentTemplatesSqlParams(
                                document_id=document_id
                            )
                            template_result = cast(
                                GetDocumentTemplatesSqlRow,
                                await execute_sql_typed(
                                    conn,
                                    "app/sql/v4/documents/get_document_templates_complete.sql",
                                    params=template_params,
                                ),
                            )

                            # Build mapping from array (now using schema_id instead of template_args)
                            template_mapping = {}
                            if (
                                hasattr(template_result, "templates")
                                and template_result.templates
                            ):
                                for template in template_result.templates:
                                    upload_id_str = (
                                        str(template.upload_id)
                                        if template.upload_id
                                        else ""
                                    )
                                    schema_id_str = (
                                        str(template.schema_id)
                                        if template.schema_id
                                        else None
                                    )
                                    template_mapping[upload_id_str] = {
                                        "template_id": str(template.template_id),
                                        "schema_id": schema_id_str,
                                        "active": template.active,
                                        "created_at": template.created_at.isoformat()
                                        if template.created_at
                                        else None,
                                        "updated_at": template.updated_at.isoformat()
                                        if template.updated_at
                                        else None,
                                    }

                    if document_id:
                        # Invalidate documents cache
                        await invalidate_tags(["documents"])

                    # Emit final completion to client
                    await sio.emit(
                        "documents_complete",
                        {
                            "success": True,
                            "document_id": document_id_str,
                            "message": "Document template created successfully",
                            "template_html": template_html,
                            "template_schema": template_schema,
                            "upload_id": upload_id,
                            "template_mapping": template_mapping,
                        },
                        room=sid,
                    )

                    # Log activity
                    try:
                        await log_websocket_activity(
                            sid=sid,
                            event_key="documents.generated",
                            template="{{ actor.name }} generated document template",
                            context={
                                "department_id": department_id_str,
                            },
                            endpoint="/socket/v4/documents/generate",
                            error=False,
                        )
                    except Exception:
                        pass

                except Exception as create_error:
                    # Error creating template - emit error event
                    await internal_sio.emit(
                        "document_error",
                        {
                            "sid": sid,
                            "success": False,
                            "message": f"Failed to create template: {str(create_error)}",
                        },
                    )
                    return

        except RuntimeError:
            # Pool not initialized - emit error event
            await internal_sio.emit(
                "document_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": "Database connection pool not available",
                },
            )
        except Exception as e:
            await internal_sio.emit(
                "document_error",
                {
                    "sid": sid,
                    "success": False,
                    "message": f"Failed to finalize document generation: {str(e)}",
                },
            )


@internal_sio.on("document_complete")  # type: ignore
async def document_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_complete event from internal bus."""
    # Directly call handler since we're handling dict data
    sid = data.get("sid", "")
    if not sid:
        return

    from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket

    profile_id = await find_profile_by_socket(sid)
    if not profile_id:
        await internal_sio.emit(
            "document_error",
            {
                "sid": sid,
                "success": False,
                "message": "Profile not found for socket",
            },
        )
        return

    group_id = None
    if data.get("group_id"):
        try:
            group_id = uuid.UUID(data["group_id"])
        except (ValueError, TypeError):
            pass

    await _document_complete_impl(sid, data, profile_id, group_id)


register_server_endpoint(
    server_router,
    "/document_complete",
    dict[str, Any],  # type: ignore[arg-type]
    "Dispatch document complete to tool-specific handlers by tool_type",
)
