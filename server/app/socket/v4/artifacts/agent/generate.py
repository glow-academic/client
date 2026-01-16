"""Agent generation router - unified handler for all agent resource types."""

import json
import uuid
from typing import Any, cast

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.error import GenerateErrorApiRequest
from app.sql.types import GetAgentApiRequest, GetAgentSqlParams, GetAgentSqlRow
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/agents/get_agent_complete.sql"

# Agent resource types
AGENT_RESOURCE_TYPES = [
    "names",
    "descriptions",
    "models",
    "prompts",
    "instructions",
    "flags",
    "departments",
]


class GenerateAgentPayload(GetAgentApiRequest):
    """Request to generate agent resources - extends GET API request with generation-specific fields."""

    agent_type: str | None = None  # Optional: "name", "description", "model", "prompt", "instructions", "flags", "departments", "general"/"all"
    resource_types: list[str]  # Required: which resource types to generate
    user_instructions: list[str] | None = None  # Optional: user instructions


async def _agent_generate_impl(
    sid: str, data: GenerateAgentPayload, profile_id: uuid.UUID
) -> None:
    """Handle agent generation - emit generate_artifact for each resource type, then emit client event."""
    try:
        # Validate resource types
        resource_types = data.resource_types
        if not resource_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="resource_types must be provided",
                    artifact_type="agent",
                    group_id=None,
                    resource_type="agent",
                ),
                sid=sid,
            )
            return

        invalid_types = [
            rt for rt in resource_types if rt not in AGENT_RESOURCE_TYPES
        ]
        if invalid_types:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid resource types: {', '.join(invalid_types)}",
                    artifact_type="agent",
                    group_id=None,
                    resource_type="agent",
                ),
                sid=sid,
            )
            return

        # Map agent_type to agent_id from response (will be done after fetching agent data)

        # Call get_agent_v4 SQL function (same as GET API endpoint)
        async with get_db_connection() as conn:
            # Convert payload to SQL params (same as GET endpoint)
            params = GetAgentSqlParams(
                profile_id=profile_id,
                agent_id=data.agent_id,
                draft_id=data.draft_id,
                mcp=getattr(data, "mcp", False) or False,
            )

            result = cast(
                GetAgentSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Map agent_type to agent_id from response
            agent_id: uuid.UUID | None = None
            if data.agent_type:
                agent_type_map = {
                    "name": result.name_agent_id,
                    "description": result.description_agent_id,
                    "model": result.models_agent_id,
                    "models": result.models_agent_id,
                    "prompt": result.prompts_agent_id,
                    "prompts": result.prompts_agent_id,
                    "instructions": result.instructions_agent_id,
                    "flags": result.flag_agent_id,
                    "departments": result.departments_agent_id,
                    "general": None,  # Will need to determine best agent for all resources
                    "all": None,  # Will need to determine best agent for all resources
                }
                agent_id = agent_type_map.get(data.agent_type)

            # For "general" or "all", we need to find an agent that can handle all resource types
            # For now, use the first available agent_id from the resource types
            if not agent_id and data.agent_type in ["general", "all"]:
                # Try to find an agent that can handle all requested resource types
                # Use the first available agent_id from the requested resource types
                for rt in resource_types:
                    rt_map = {
                        "names": result.name_agent_id,
                        "descriptions": result.description_agent_id,
                        "models": result.models_agent_id,
                        "prompts": result.prompts_agent_id,
                        "instructions": result.instructions_agent_id,
                        "flags": result.flag_agent_id,
                        "departments": result.departments_agent_id,
                    }
                    candidate_agent_id = rt_map.get(rt)
                    if candidate_agent_id:
                        agent_id = candidate_agent_id
                        break

            if not agent_id:
                await emit_to_internal(
                    "generate_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"No agent found for agent_type: {data.agent_type}",
                        artifact_type="agent",
                        group_id=None,
                        resource_type="agent",
                    ),
                    sid=sid,
                )
                return

            # Extract resource IDs from arrays and build resources array (composite type format)
            resources: list[dict[str, Any]] = []

            # Extract IDs from each resource array
            if result.names:
                resources.append({
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in result.names if n.id]
                })
            if result.descriptions:
                resources.append({
                    "resource_type": "descriptions",
                    "resource_ids": [str(d.id) for d in result.descriptions if d.id]
                })
            if result.models:
                resources.append({
                    "resource_type": "models",
                    "resource_ids": [str(m.model_id) for m in result.models if m.model_id]
                })
            if result.prompts:
                resources.append({
                    "resource_type": "prompts",
                    "resource_ids": [str(p.prompt_id) for p in result.prompts if p.prompt_id]
                })
            if result.instructions:
                resources.append({
                    "resource_type": "instructions",
                    "resource_ids": [str(inst.id) for inst in result.instructions if inst.id]
                })
            if result.departments:
                resources.append({
                    "resource_type": "departments",
                    "resource_ids": [str(d.department_id) for d in result.departments if d.department_id]
                })

            # Get group_id from response if available
            group_id: uuid.UUID | None = result.group_id

            # Emit single generate_artifact event with all resource types
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "agent",
                    "agent_id": str(agent_id),  # Use agent_id from mapping
                    "resource_types": resource_types,  # Pass all resource types at once
                    "group_id": str(group_id) if group_id else None,
                    "resources": resources,  # Pass resources array
                    "user_instructions": data.user_instructions
                    if data.user_instructions
                    else None,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate agent resources: {str(e)}",
                artifact_type="agent",
                group_id=None,
                resource_type="agent",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def agent_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle agent_generate event (client-to-server)."""
    try:
        payload = GenerateAgentPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="agent",
                    group_id=None,
                    resource_type="agent",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _agent_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="agent",
                group_id=None,
                resource_type="agent",
            ),
            sid=sid,
        )


@internal_sio.on("agent_generate")  # type: ignore
async def agent_generate_internal(data: dict[str, Any]) -> None:
    """Handle agent_generate event from internal bus (server-to-server)."""
    try:
        sid = data.get("sid", "")
        if not sid:
            return

        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="agent",
                    group_id=None,
                    resource_type="agent",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = GenerateAgentPayload(**data)
        await _agent_generate_impl(sid, payload, profile_id)
    except Exception as e:
        await emit_to_internal(
            "generate_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="agent",
                group_id=None,
                resource_type="agent",
            ),
            sid=sid,
        )
