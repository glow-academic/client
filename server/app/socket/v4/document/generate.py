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

            from app.sql.types import GetDocumentRunContextAndCreateRunSqlRow
            from typing import cast

            result = cast(
                GetDocumentRunContextAndCreateRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

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
            if hasattr(result, "template_context_fields") and result.template_context_fields:
                fields_data = [
                    {
                        "item_name": field.item_name or "",
                        "item_description": field.item_description or "",
                        "param_name": field.param_name or "",
                        "param_description": field.param_description or "",
                    }
                    for field in result.template_context_fields
                ]

            department_name: str | None = (
                result.department_name if hasattr(result, "department_name") else None
            )

            # Step 1: Format document template context
            document_name_val = (
                data.document_name
                or (result.document_name if hasattr(result, "document_name") else None)
                or ""
            )
            document_description_val = (
                data.document_description
                or (
                    result.document_description
                    if hasattr(result, "document_description")
                    else None
                )
                or ""
            )
            context_items = format_document_template_context(
                document_name=document_name_val,
                document_description=document_description_val,
                department_name=department_name,
                fields=fields_data,
            )

            # Get developer instruction using new renderer with resource-schema-based context
            from app.infra.v4.developer_instructions.render_developer_instruction import (
                render_developer_instruction,
            )

            # Get agent_id from result (best_agent provides agent_id)
            agent_id: uuid.UUID | None = None
            if hasattr(result, "agent_id") and result.agent_id:
                agent_id = uuid.UUID(result.agent_id)
            else:
                # Fallback: get agent_id from document's domain
                agent_id = await conn.fetchval(
                    """
                    SELECT d.agent_id
                    FROM documents doc
                    JOIN domains d ON d.id = doc.document_domain_id
                    WHERE doc.id = $1
                    LIMIT 1
                    """,
                    uuid.UUID(data.document_id),
                )

            developer_message_content: str | None = None
            if agent_id:
                try:
                    # Use new renderer with resource-schema-based context
                    # For documents, scenario_id is None (documents are standalone)
                    developer_message_content = await render_developer_instruction(
                        conn, agent_id, scenario_id=None
                    )
                except Exception as e:
                    # Log error but continue - developer instruction is optional
                    import logging
                    logging.getLogger(__name__).warning(
                        f"Failed to render developer instruction: {e}"
                    )

            # Fallback to old method if new renderer returns None
            if (
                not developer_message_content
                and hasattr(result, "developer_instruction_template")
                and result.developer_instruction_template
            ):
                # Render Jinja template (no context variables - old method)
                template = Template(result.developer_instruction_template)
                developer_message_content = template.render()

            if developer_message_content:
                context_items.append(
                    {
                        "role": "developer",
                        "content": developer_message_content,
                    }
                )

            # Step 2: Route to generate_artifact (which will create run and handle generation)
            # Convert context items to developer_message_contents
            developer_message_contents = [
                item["content"] for item in context_items if item.get("role") == "developer"
            ]
            # Also include user messages as developer messages for context
            user_messages = [
                item["content"] for item in context_items if item.get("role") == "user"
            ]
            developer_message_contents.extend(user_messages)

            # Get agent_id for generate_artifact from result
            if not agent_id:
                # Get agent_id from result (best_agent provides agent_id)
                if hasattr(result, "agent_id") and result.agent_id:
                    agent_id = uuid.UUID(result.agent_id)
                else:
                    # Fallback: get agent_id from document's domain
                    agent_id = await conn.fetchval(
                        """
                        SELECT d.agent_id
                        FROM documents doc
                        JOIN domains d ON d.id = doc.document_domain_id
                        WHERE doc.id = $1
                        LIMIT 1
                        """,
                        uuid.UUID(data.document_id),
                    )

            if not agent_id:
                raise ValueError("Could not determine agent_id for document generation")

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "agent_id": str(agent_id),
                    "resource_id": data.document_id,
                    "resource_type": "document",
                    "group_id": None,  # Will be created by generate_artifact
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
    
    Routes directly to artifacts/generate.py which will create run and handle generation.
    """
    try:
        # Route to artifacts/generate.py which will create run and handle generation
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

