"""Agent generation router - unified handler for all agent resource types."""

import uuid
from typing import Any, cast

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import GetAgentApiRequest, GetAgentSqlParams, GetAgentSqlRow
from fastapi import APIRouter
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/queries/agents/get_agent_complete.sql"
CREATE_RUN_SQL_PATH = "app/sql/v4/queries/generate/start/get_generation_run_context_and_create_run_complete.sql"
TEXT_RUN_CONTEXT_SQL_PATH = "app/sql/v4/queries/generate/text/get_text_run_context_for_existing_run_complete.sql"

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
                "generate_call_error",
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
                "generate_call_error",
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
                    "generate_call_error",
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

            resources_sql = normalize_resources_for_sql(resources)

            create_run_sql = load_sql(CREATE_RUN_SQL_PATH)
            create_run_row = await conn.fetchrow(
                create_run_sql,
                agent_id,
                profile_id,
                None,
                None,
                group_id,
                None,
                data.user_instructions if data.user_instructions else None,
                resources_sql,
            )

            if not create_run_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create generation run",
                        artifact_type="agent",
                        group_id=str(group_id) if group_id else None,
                        resource_type="agent",
                    ),
                    sid=sid,
                )
                return

            run_id = str(create_run_row["run_id"])
            group_id = (
                create_run_row["group_id"] if create_run_row["group_id"] else group_id
            )
            trace_id = create_run_row.get("trace_id")
            message_ids = create_run_row.get("message_ids")

            run_context_sql = load_sql(TEXT_RUN_CONTEXT_SQL_PATH)
            run_context_row = await conn.fetchrow(
                run_context_sql,
                uuid.UUID(run_id),
                agent_id,
                message_ids,
                group_id,
                resources_sql,
            )

            if not run_context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to load generation context",
                        artifact_type="agent",
                        group_id=str(group_id) if group_id else None,
                        resource_type="agent",
                    ),
                    sid=sid,
                )
                return

            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=run_context_row.get("context"),
            )

            messages: list[dict[str, Any]] = []
            if run_context_row.get("system_prompt"):
                messages.append(
                    {"role": "system", "content": run_context_row["system_prompt"]}
                )
            for dev_msg in rendered_developer_messages:
                messages.append({"role": "developer", "content": dev_msg})
            for user_msg in data.user_instructions or []:
                messages.append({"role": "user", "content": user_msg})

            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "agent",
                    "resource_type": resource_types[0] if resource_types else "agent",
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
                    "message_id": None,
                    "messages": messages,
                    "llm_config": {
                        "model": run_context_row.get("model_name"),
                        "api_key": run_context_row.get("api_key"),
                        "base_url": run_context_row.get("base_url"),
                        "temperature": run_context_row.get("temperature"),
                        "reasoning": run_context_row.get("reasoning"),
                        "provider": run_context_row.get("provider"),
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                    "tools": convert_tools_to_dict(run_context_row.get("tools")),
                    "metadata": {"trace_id": trace_id},
                    "eval_mode": False,
                },
            )

    except Exception as e:
        await emit_to_internal(
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
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
                "generate_call_error",
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
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="agent",
                group_id=None,
                resource_type="agent",
            ),
            sid=sid,
        )
