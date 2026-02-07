"""Tool generation handler - domain_ids-based generation following persona gold standard.

This module handles all business logic for tool generation:
- Validates domain_ids and derives resource_types + agent_id via get_tool_websocket()
- Delegates run creation and LLM invocation to generation_common helpers
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.api.v4.artifacts.tool.get import get_tool_websocket
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio

# Import generation helpers (handles run creation, context fetch, message rendering)
from app.socket.v4.artifacts.generation_common import (
    emit_generate_artifact,
)
from app.socket.v4.artifacts.tool.types import GenerateToolPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

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
    """Handle tool generation with domain_ids-based routing.

    This function:
    1. Validates domain_ids
    2. Fetches tool data via get_tool_websocket() for domain mapping
    3. Derives resource_types and agent_id from domain mappings
    4. Delegates to generation_common for run creation and LLM invocation
    """
    try:
        # Validate domain_ids
        if not data.domain_ids:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="domain_ids must be provided",
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

        # Step 1: Fetch tool data for domain mapping using websocket function
        result = await get_tool_websocket(
            profile_id=profile_id,
            tool_id=data.tool_id,
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
            result.args_domain_id: "args",
            result.args_outputs_domain_id: "args_outputs",
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
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

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
                    artifact_type="tool",
                    group_id=None,
                    resource_type="tool",
                ),
                sid=sid,
            )
            return

        # Get group_id from tool response if available
        existing_group_id: uuid.UUID | None = result.group_id

        # Step 2: Delegate to generation_common for run creation and LLM invocation
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
        logger.exception(f"Failed to generate tool resources: {str(e)}")
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
