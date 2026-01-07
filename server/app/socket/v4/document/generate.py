"""Document page handler - handles template context formatting logic, then routes to artifacts/generate.py."""

import uuid
from typing import Any

from app.infra.v4.documents.format_document_template_context import (
    format_document_template_context,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from fastapi import APIRouter
from jinja2 import Template
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/documents/get_document_run_context_and_create_run_complete.sql"


class GenerateDocumentPayload(BaseModel):
    """Request to generate a document."""

    document_id: str
    document_domain_id: str
    document_name: str | None = None
    document_description: str | None = None
    department_id: str | None = None


async def _generate_document_impl(
    sid: str, data: GenerateDocumentPayload, profile_id: uuid.UUID
) -> None:
    """Handle document generation - format template context then route to artifacts."""
    try:
        async with get_db_connection() as conn:
            # Get document context from SQL (fields, department, etc.)
            from app.sql.types import (
                GetDocumentRunContextAndCreateRunSqlParams,
                GetDocumentRunContextAndCreateRunSqlRow,
            )

            # Get department_id from document if not provided
            if not data.department_id:
                # Query document to get department_id
                doc_sql = "SELECT department_id FROM document_departments WHERE document_id = $1 AND active = true LIMIT 1"
                dept_id = await conn.fetchval(doc_sql, uuid.UUID(data.document_id))
                if not dept_id:
                    raise ValueError("Document must have a department")
                department_id = dept_id
            else:
                department_id = uuid.UUID(data.department_id)
            
            params = GetDocumentRunContextAndCreateRunSqlParams(
                document_id=uuid.UUID(data.document_id),
                profile_id=profile_id,
                department_id=department_id,
                document_name=data.document_name,
                document_description=data.document_description,
                field_ids=None,  # Will be populated from document if needed
            )

            result = await execute_sql_typed(conn, SQL_PATH, params=params)

            if not result:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to get document context",
                        resource_id=data.document_id,
                        group_id=None,
                        resource_type="document",
                    ),
                    sid=sid,
                )
                return

            # Extract fields and department from result
            fields_data: list[dict[str, Any]] | None = None
            if result.template_context_fields:
                fields_data = [
                    {
                        "item_name": field.item_name or "",
                        "item_description": field.item_description or "",
                        "param_name": field.param_name or "",
                        "param_description": field.param_description or "",
                    }
                    for field in result.template_context_fields
                ]

            department_name: str | None = result.department_name

            # Step 1: Format document template context
            context_items = format_document_template_context(
                document_name=data.document_name or result.document_name or "",
                document_description=data.document_description
                or result.document_description
                or "",
                department_name=department_name,
                fields=fields_data,
            )

            # Get developer instruction template from SQL result
            developer_message_content: str | None = (
                result.developer_instruction_template
            )
            if developer_message_content:
                # Render Jinja template (no context variables needed for document)
                template = Template(developer_message_content)
                developer_message_content = template.render()
                context_items.append(
                    {
                        "role": "developer",
                        "content": developer_message_content,
                    }
                )

            # Step 2: Route to generate_start (which will route to artifacts/generate.py)
            # Convert context items to developer_message_contents
            developer_message_contents = [
                item["content"] for item in context_items if item.get("role") == "developer"
            ]
            # Also include user messages as developer messages for context
            user_messages = [
                item["content"] for item in context_items if item.get("role") == "user"
            ]
            developer_message_contents.extend(user_messages)

            await internal_sio.emit(
                "generate_start",
                {
                    "sid": sid,
                    "agent_id": data.document_agent_id,
                    "resource_id": data.document_id,
                    "resource_type": "document",
                    "group_id": None,  # Will be created by generate_start
                    "user_instructions": None,
                    "message_ids": None,
                    "developer_message_contents": developer_message_contents,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate document: {str(e)}",
                resource_id=data.document_id,
                group_id=None,
                resource_type="document",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def document_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle document_generate event (client-to-server)."""
    try:
        payload = GenerateDocumentPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    resource_id=data.get("document_id"),
                    group_id=None,
                    resource_type="document",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _generate_document_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                resource_id=data.get("document_id"),
                group_id=None,
                resource_type="document",
            ),
            sid=sid,
        )


@internal_sio.on("document_generate")  # type: ignore
async def document_generate_internal(data: dict[str, Any]) -> None:
    """Handle document_generate event from internal bus (server-to-server).
    
    This is called by generate_start after run creation. It receives run_id
    and routes directly to artifacts/generate.py.
    """
    try:
        # This is called from generate_start with run_id already created
        # Just route to artifacts/generate.py
        await internal_sio.emit("generate_artifact", data)
    except Exception as e:
        sid = data.get("sid", "")
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to route document generation: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type="document",
            ),
            sid=sid,
        )

