"""Agent generation router - unified handler for all agent resource types.

Uses the three-layer architecture: calls get_agent_websocket() for data,
then uses domain-based agent lookup for generation context.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.agent.get import get_agent_websocket
from app.api.v4.artifacts.agent.types import (
    AgentResourceBucket,
    GetAgentWebsocketResponse,
)
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.generation.resource_utils import normalize_resources_for_sql
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.agent.permissions import (
    GenerationContext,
    format_generation_error,
    validate_generation_access,
)
from app.socket.v4.artifacts.agent.types import GenerateAgentPayload
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetPersonaGenerationContextSqlParams,
    GetPersonaGenerationContextSqlRow,
)
from app.utils.sql_helper import execute_sql_typed, load_sql

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()

# SQL paths — reuse persona generation context (shared agent/model/rate-limit check)
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/persona/get_persona_generation_context_complete.sql"
)
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
    "tools",
    "temperature_levels",
    "reasoning_levels",
    "voices",
]


def _build_agent_jinja_context(
    response: GetAgentWebsocketResponse, resource_types: list[str]
) -> dict[str, Any]:
    """Build Jinja context from agent websocket response."""
    _ = resource_types
    if response.resources:
        return response.resources.model_dump(mode="json")
    return AgentResourceBucket().model_dump(mode="json")


async def _agent_generate_impl(
    sid: str, data: GenerateAgentPayload, profile_id: uuid.UUID
) -> None:
    """Handle agent generation with domain-based agent lookup.

    This function:
    1. Validates resource_types and resolves agent_id via resource_agent_ids
    2. Fetches agent data via get_agent_websocket() for generation context
    3. Validates generation prerequisites (agent, model, rate limit)
    4. Creates run and fetches context
    5. Renders developer instructions with Jinja
    6. Emits simplified payload to generate_artifact handler
    """
    try:
        # Validate resource_types
        if not data.resource_types:
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

        # Step 1: Fetch agent data for domain-to-agent mapping
        result = await get_agent_websocket(
            profile_id=profile_id,
            agent_id=data.agent_id,
            draft_id=data.draft_id,
        )

        resource_types = [rt for rt in data.resource_types if rt]
        if not resource_types:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No valid resource_types provided",
                    artifact_type="agent",
                    group_id=None,
                    resource_type="agent",
                ),
                sid=sid,
            )
            return

        invalid_types = [rt for rt in resource_types if rt not in AGENT_RESOURCE_TYPES]
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

        # Resolve agent_id from websocket resource_agent_ids
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = None
        for rt in resource_types:
            selected = resource_agent_ids.get(rt)
            if selected is not None:
                agent_id = selected
                break

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for the requested resource_types",
                    artifact_type="agent",
                    group_id=None,
                    resource_type="agent",
                ),
                sid=sid,
            )
            return

        agent_jinja_context = _build_agent_jinja_context(result, resource_types)

        # Build resources list from websocket response
        resources: list[dict[str, Any]] = []
        resources_bucket = result.resources

        if resources_bucket and resources_bucket.names:
            resources.append(
                {
                    "resource_type": "names",
                    "resource_ids": [str(n.id) for n in resources_bucket.names if n.id],
                }
            )
        if resources_bucket and resources_bucket.descriptions:
            resources.append(
                {
                    "resource_type": "descriptions",
                    "resource_ids": [
                        str(d.id) for d in resources_bucket.descriptions if d.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.models:
            resources.append(
                {
                    "resource_type": "models",
                    "resource_ids": [
                        str(m.id) for m in resources_bucket.models if m.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.prompts:
            resources.append(
                {
                    "resource_type": "prompts",
                    "resource_ids": [
                        str(p.id) for p in resources_bucket.prompts if p.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.instructions:
            resources.append(
                {
                    "resource_type": "instructions",
                    "resource_ids": [
                        str(i.id) for i in resources_bucket.instructions if i.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.departments:
            resources.append(
                {
                    "resource_type": "departments",
                    "resource_ids": [
                        str(d.department_id)
                        for d in resources_bucket.departments
                        if d.department_id
                    ],
                }
            )
        if resources_bucket and resources_bucket.tools:
            resources.append(
                {
                    "resource_type": "tools",
                    "resource_ids": [str(t.id) for t in resources_bucket.tools if t.id],
                }
            )
        if resources_bucket and resources_bucket.temperature_levels:
            resources.append(
                {
                    "resource_type": "temperature_levels",
                    "resource_ids": [
                        str(t.id) for t in resources_bucket.temperature_levels if t.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.reasoning_levels:
            resources.append(
                {
                    "resource_type": "reasoning_levels",
                    "resource_ids": [
                        str(r.id) for r in resources_bucket.reasoning_levels if r.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.voices:
            resources.append(
                {
                    "resource_type": "voices",
                    "resource_ids": [
                        str(v.id) for v in resources_bucket.voices if v.id
                    ],
                }
            )
        if resources_bucket and resources_bucket.flags:
            flag_ids = [
                str(f.flag_option_id)
                for f in resources_bucket.flags
                if f.flag_option_id
            ]
            if flag_ids:
                resources.append(
                    {
                        "resource_type": "flags",
                        "resource_ids": flag_ids,
                    }
                )

        group_id: uuid.UUID | None = result.group_id

        # Step 2: Validate generation prerequisites
        async with get_db_connection() as conn:
            context_params = GetPersonaGenerationContextSqlParams(
                p_profile_id=profile_id,
                p_agent_id=agent_id,
            )
            context_row = cast(
                GetPersonaGenerationContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            ctx = GenerationContext(
                agent_exists=context_row.agent_exists or False,
                agent_name=context_row.agent_name,
                agent_is_active=context_row.agent_is_active or False,
                model_id=context_row.model_id,
                model_name=context_row.model_name,
                provider_id=context_row.provider_id,
                provider_name=context_row.provider_name,
                has_api_key=context_row.has_api_key or False,
                requests_per_day=context_row.requests_per_day,
                runs_today=context_row.runs_today or 0,
            )

            is_valid, failures = validate_generation_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message=f"Failed to prepare agent generation: {error_msg}",
                        artifact_type="agent",
                        group_id=str(group_id) if group_id else None,
                        resource_type="agent",
                    ),
                    sid=sid,
                )
                return

            # Step 3: Create run and fetch context
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

            # Step 4: Render developer instructions with Jinja
            rendered_developer_messages = render_developer_instructions(
                templates=run_context_row.get("developer_instruction_templates"),
                jinja_context=agent_jinja_context,
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

            # Step 5: Emit to generate_artifact handler
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
