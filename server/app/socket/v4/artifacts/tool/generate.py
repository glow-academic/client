"""Tool generation handler using resource_types-based routing."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.tool.get import get_tool_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.generation_common import emit_generate_artifact
from app.socket.v4.artifacts.tool.types import GenerateToolPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# Tool resource types
TOOL_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "args",
    "args_outputs",
    "flags",
]


async def _tool_generate_impl(
    sid: str, data: GenerateToolPayload, profile_id: uuid.UUID
) -> None:
    """Handle tool generation with resource_types-based routing."""
    try:
        if not data.resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        if not data.draft_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Draft ID is required for tool generation",
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        result = await get_tool_websocket(
            profile_id=profile_id,
            tool_id=data.tool_id,
            draft_id=data.draft_id,
        )

        resource_types = data.resource_types

        invalid_types = [rt for rt in resource_types if rt not in TOOL_RESOURCE_TYPES]
        if invalid_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for rt in resource_types:
            aid = resource_agent_ids.get(rt)
            if aid is not None:
                agent_id = aid
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for requested resource types",
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        config_agents = result.resources.agents or []
        config_models = result.resources.models or []
        config_providers = result.resources.providers or []
        if not config_agents or not config_models or not config_providers:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=(
                        "Missing generation configuration resources "
                        "(agents/models/providers)"
                    ),
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        existing_group_id: uuid.UUID | None = result.group_id

        async with get_db_connection() as conn:
            await emit_generate_artifact(
                conn=conn,
                sid=sid,
                artifact_type="tool",
                resource_id=str(data.tool_id) if data.tool_id else None,
                resource_types=resource_types,
                user_instructions=data.user_instructions,
                profile_id=profile_id,
                agent_id=agent_id,
                group_id=existing_group_id,
            )

    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate tool resources: {str(e)}",
                artifact_type="tool",
                group_id=None,
                resource_type="tool",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def tool_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle tool_generate event (client-to-server)."""
    try:
        payload = GenerateToolPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _tool_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="tool",
                group_id=None,
                resource_type="tool",
            ),
            sid=sid,
        )


@internal_sio.on("tool_generate")  # type: ignore
async def tool_generate_internal(data: dict[str, Any]) -> None:
    """Handle tool_generate event from internal bus (server-to-server)."""
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
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateToolPayload(**data)
        await _tool_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="tool",
                group_id=None,
                resource_type="tool",
            ),
            sid=sid,
        )
