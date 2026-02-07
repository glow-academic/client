"""Document page handler - handles template context formatting logic, then routes to artifacts/generate.py."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.documents.format_document_template_context import (
    format_document_template_context,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetDocumentAgentIdV4SqlParams,
    GetDocumentAgentIdV4SqlRow,
    GetDocumentDepartmentV4SqlParams,
    GetDocumentDepartmentV4SqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/queries/documents/get_document_run_context_and_create_run_complete.sql"
)
GET_DOCUMENT_DEPARTMENT_SQL_PATH = (
    "app/sql/v4/queries/document/get_document_department_v4_complete.sql"
)
GET_DOCUMENT_AGENT_ID_SQL_PATH = (
    "app/sql/v4/queries/document/get_document_agent_id_v4_complete.sql"
)


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
                dept_params = GetDocumentDepartmentV4SqlParams(
                    document_id=uuid.UUID(data.document_id)
                )
                dept_result = cast(
                    GetDocumentDepartmentV4SqlRow,
                    await execute_sql_typed(
                        conn, GET_DOCUMENT_DEPARTMENT_SQL_PATH, params=dept_params
                    ),
                )
                if not dept_result or not dept_result.department_id:
                    raise ValueError("Document must have a department")
                department_id = dept_result.department_id
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

            result = cast(
                GetDocumentRunContextAndCreateRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not result:
                await emit_to_internal(
                    "generate_call_error",
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
            if (
                hasattr(result, "template_context_fields")
                and result.template_context_fields
            ):
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

            # Step 2: Route to generate_artifact (token factory)
            # Get agent_id for generation from result
            agent_id: uuid.UUID | None = None
            if not agent_id:
                # Get agent_id from result (best_agent provides agent_id)
                if hasattr(result, "agent_id") and result.agent_id:
                    agent_id = uuid.UUID(result.agent_id)
                else:
                    # Fallback: get agent_id from document's domain
                    agent_params = GetDocumentAgentIdV4SqlParams(
                        document_id=uuid.UUID(data.document_id)
                    )
                    agent_result = cast(
                        GetDocumentAgentIdV4SqlRow,
                        await execute_sql_typed(
                            conn, GET_DOCUMENT_AGENT_ID_SQL_PATH, params=agent_params
                        ),
                    )
                    agent_id = agent_result.agent_id if agent_result else None

            if not agent_id:
                raise ValueError("Could not determine agent_id for document generation")

            rendered_developer_messages = render_developer_instructions(
                templates=[result.developer_instruction_template]
                if result.developer_instruction_template
                else None,
                jinja_context=None,
            )

            messages: list[dict[str, Any]] = []
            if result.system_prompt:
                messages.append({"role": "system", "content": result.system_prompt})
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for context_item in context_items:
                messages.append(context_item)

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "document",
                    "resource_type": "document",
                    "run_id": str(result.run_id),
                    "group_id": str(result.group_id) if result.group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": result.model_name,
                        "api_key": result.api_key,
                        "base_url": result.base_url,
                        "temperature": result.temperature,
                        "reasoning": result.reasoning,
                        "provider": result.provider,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(result.tools),
                    "metadata": {"trace_id": result.trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
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
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to route document generation: {str(e)}",
                resource_id=data.get("resource_id"),
                group_id=data.get("group_id"),
                resource_type="document",
            ),
            sid=sid,
        )
