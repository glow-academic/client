"""Document page handler - handles template context formatting logic, then routes to artifacts/generate.py."""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.document.get import get_document_websocket
from app.api.v4.artifacts.document.types import (
    DocumentResourceBucket,
    GetDocumentWebsocketResponse,
)
from app.infra.v4.documents.format_document_template_context import (
    format_document_template_context,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.document.types import GenerateDocumentPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetDocumentRunContextAndCreateRunSqlParams,
    GetDocumentRunContextAndCreateRunSqlRow,
)
from app.utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = (
    "app/sql/v4/queries/documents/get_document_run_context_and_create_run_complete.sql"
)

# Document resource types
DOCUMENT_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "flags",
    "departments",
    "fields",
    "uploads",
]


def _build_document_jinja_context(
    response: GetDocumentWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from document websocket response."""
    if response.resources and response.resources.resources:
        resources = response.resources.resources.model_dump()
        current = (
            response.resources.current.model_dump()
            if response.resources.current
            else DocumentResourceBucket().model_dump()
        )
        resources["current"] = current
        return resources
    return {"current": DocumentResourceBucket().model_dump()}


async def _generate_document_impl(
    sid: str, data: GenerateDocumentPayload, profile_id: uuid.UUID
) -> None:
    """Handle document generation - use get_document_websocket() for data, then route to artifacts."""
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
                    artifact_type="document",
                    group_id=None,
                    resource_type="document",
                ),
                sid=sid,
            )
            return

        # Step 1: Fetch document data using websocket function
        result = await get_document_websocket(
            profile_id=profile_id,
            document_id=data.document_id,
            draft_id=data.draft_id,
        )

        # Build domain_id -> agent_id mapping from result.domains
        domain_to_agent: dict[uuid.UUID, uuid.UUID | None] = {}
        if result.domains:
            for domain in result.domains:
                domain_to_agent[domain.domain_id] = domain.agent_id

        # Build domain_id -> resource_type mapping from result
        domain_to_resource: dict[uuid.UUID | None, str] = {
            result.name_domain_id: "names",
            result.description_domain_id: "descriptions",
            result.flag_domain_id: "flags",
            result.departments_domain_id: "departments",
            result.fields_domain_id: "fields",
            result.uploads_domain_id: "uploads",
        }
        # Remove None key if present
        domain_to_resource.pop(None, None)

        # Derive resource_types from domain_ids
        resource_types: list[str] = []
        for did in data.domain_ids:
            if did in domain_to_resource:
                resource_types.append(domain_to_resource[did])

        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No valid domain_ids provided",
                    artifact_type="document",
                    group_id=None,
                    resource_type="document",
                ),
                sid=sid,
            )
            return

        # Get agent_id from the first valid domain_id
        agent_id: uuid.UUID | None = None
        for did in data.domain_ids:
            if did in domain_to_agent and domain_to_agent[did] is not None:
                agent_id = domain_to_agent[did]
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested domains",
                    artifact_type="document",
                    group_id=None,
                    resource_type="document",
                ),
                sid=sid,
            )
            return

        # Extract current document context for template rendering
        current_name: str | None = None
        current_description: str | None = None
        department_name: str | None = None

        if result.resources and result.resources.current:
            current = result.resources.current
            if current.names:
                current_name = getattr(current.names[0], "name", None)
            if current.descriptions:
                current_description = getattr(
                    current.descriptions[0], "description", None
                )
            if current.departments:
                department_name = getattr(current.departments[0], "name", None)

        # Get fields data for template context
        fields_data: list[dict[str, Any]] | None = None
        if (
            result.resources
            and result.resources.resources
            and result.resources.resources.fields
        ):
            fields_data = [
                {
                    "item_name": getattr(f, "name", "") or "",
                    "item_description": getattr(f, "description", "") or "",
                    "param_name": "",
                    "param_description": "",
                }
                for f in result.resources.resources.fields
            ]

        existing_group_id = result.group_id

        async with get_db_connection() as conn:
            # Get department_id from first department if available
            department_id: uuid.UUID | None = None
            if (
                result.resources
                and result.resources.current
                and result.resources.current.departments
            ):
                department_id = getattr(
                    result.resources.current.departments[0], "department_id", None
                )

            params = GetDocumentRunContextAndCreateRunSqlParams(
                document_id=data.document_id,
                profile_id=profile_id,
                department_id=department_id,
                document_name=current_name,
                document_description=current_description,
                field_ids=None,
            )

            run_result = cast(
                GetDocumentRunContextAndCreateRunSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            if not run_result:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to get document context",
                        resource_id=str(data.document_id) if data.document_id else None,
                        group_id=str(existing_group_id) if existing_group_id else None,
                        resource_type="document",
                    ),
                    sid=sid,
                )
                return

            # Format document template context
            context_items = format_document_template_context(
                document_name=current_name or "",
                document_description=current_description or "",
                department_name=department_name,
                fields=fields_data,
            )

            rendered_developer_messages = render_developer_instructions(
                templates=[run_result.developer_instruction_template]
                if run_result.developer_instruction_template
                else None,
                jinja_context=None,
            )

            messages: list[dict[str, Any]] = []
            if run_result.system_prompt:
                messages.append({"role": "system", "content": run_result.system_prompt})
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for context_item in context_items:
                messages.append(context_item)

            # Add user instructions if provided
            if data.user_instructions:
                for instruction in data.user_instructions:
                    messages.append({"role": "user", "content": instruction})

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "document",
                    "resource_type": resource_types[0]
                    if resource_types
                    else "document",
                    "run_id": str(run_result.run_id),
                    "group_id": str(run_result.group_id)
                    if run_result.group_id
                    else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": run_result.model_name,
                        "api_key": run_result.api_key,
                        "base_url": run_result.base_url,
                        "temperature": run_result.temperature,
                        "reasoning": run_result.reasoning,
                        "provider": run_result.provider,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(run_result.tools),
                    "metadata": {"trace_id": run_result.trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate document: {str(e)}",
                resource_id=str(data.document_id) if data.document_id else None,
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
    """Handle document_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="document",
                    group_id=None,
                    resource_type="document",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateDocumentPayload(**data)
        await _generate_document_impl(sid, payload, profile_id)
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
