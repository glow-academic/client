"""Attempt simulation message handler.

Handles the attempt_message WebSocket event to send a message during simulation.
Creates user message + assistant placeholder, fetches context, and routes
to generate_artifact handler for AI response generation.

Follows the grade.py pattern:
1. Lightweight context SQL → access, rate limits, attempt/chat state
2. get_attempt_websocket() → cached resources + views
3. Python validates LLM config from pre-fetched resources
4. Parallel fetch: tools, system prompt, developer instructions
5. Slim prepare SQL → mutations only, takes resolved IDs
6. Build tool_meta + chat history + Jinja context from pre-fetched data

Entry types: ['contents', 'hints'] - Message response tools
"""

import asyncio
import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.attempt.get import get_attempt_websocket
from app.api.v4.artifacts.attempt.types import GetAttemptWebsocketResponse
from app.api.v4.resources.instructions.get import get_instructions_internal
from app.api.v4.resources.prompts.get import get_prompts_internal
from app.infra.v4.artifacts.discovery import extract_template_variable_name
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.tools.render_tool_template import GET_OUTPUT_SCHEMA_FIELDS_SQL_PATH
from app.infra.v4.websocket.attempt.run_store import (
    ENTRY_TYPE_DISPLAY_COLUMNS,
    ToolStreamingMeta,
    set_run_context,
)
from app.infra.v4.websocket.attempt.types import (
    ATTEMPT_MESSAGE_ENTRY_TYPES,
    AttemptAssistantStartEvent,
    AttemptMessagePayload,
    AttemptUserCompleteEvent,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, get_pool, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetAgentEntryToolsSqlParams,
    GetAgentEntryToolsSqlRow,
    GetAttemptMessageContextSqlParams,
    GetAttemptMessageContextSqlRow,
    GetResourceOutputSchemaFieldsSqlParams,
    GetResourceOutputSchemaFieldsSqlRow,
    PrepareAttemptMessageSqlParams,
    PrepareAttemptMessageSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_CONTEXT = (
    "app/sql/v4/queries/generate/attempt/get_attempt_message_context_complete.sql"
)
SQL_PATH_PREPARE = (
    "app/sql/v4/queries/generate/attempt/prepare_attempt_message_complete.sql"
)
SQL_PATH_AGENT_ENTRY_TOOLS = (
    "app/sql/v4/queries/generate/attempt/get_agent_entry_tools_complete.sql"
)


def _build_attempt_jinja_context(
    result: GetAttemptWebsocketResponse,
) -> dict[str, Any]:
    """Build Jinja context from websocket response.

    Resources are the current selections (from get_attempt_internal's config chain).
    Templates access resources directly: {{ rubrics }}, {{ agents[0].temperature }}
    Views (e.g. simulation_messages) are injected separately.
    """
    if result.resources:
        return result.resources.model_dump(mode="json")
    return {}


async def _attempt_message_impl(
    sid: str, data: AttemptMessagePayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt message with all business logic.

    This function:
    1. Fetches attempt data via lightweight context SQL (rate limit, access, chat state)
    2. Fetches attempt data via get_attempt_websocket() (cached, includes config chain)
    3. Extracts LLM config from pre-fetched resources (agent/model/provider)
    4. Parallel fetches tools, prompts, and instructions
    5. Calls slim prepare SQL (mutations only: run/config/messages)
    6. Builds tool_meta, chat history, Jinja context from pre-fetched data
    7. Emits to generate_artifact handler
    """
    try:
        message_str = data.message

        if not message_str or not message_str.strip():
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Missing or empty message",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Step 1: Lightweight context SQL → validate access, rate limits, chat state
        async with get_db_connection() as conn:
            context_params = GetAttemptMessageContextSqlParams(
                p_profile_id=profile_id,
                p_simulation_id=data.simulation_id,
                p_chat_id=data.chat_id,
            )

            context_row = cast(
                GetAttemptMessageContextSqlRow,
                await execute_sql_typed(conn, SQL_PATH_CONTEXT, params=context_params),
            )

            if not context_row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to fetch message context",
                        artifact_type="attempt",
                        group_id=None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

        # Validate simulation access
        if not context_row.simulation_exists:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Simulation does not exist",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        if not context_row.simulation_is_active:
            sim_name = context_row.simulation_name or "unknown"
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Simulation '{sim_name}' is not active",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Check cohort access (skip if attempt exists — implies access was granted)
        if not context_row.profile_has_access and not context_row.attempt_exists:
            sim_name = context_row.simulation_name or "unknown"
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"You do not have access to simulation '{sim_name}'",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Check attempt exists and is active
        if not context_row.attempt_exists:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Attempt does not exist",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        if not context_row.attempt_is_active:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Attempt is no longer active",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Check chat exists and is not completed
        if not context_row.chat_exists:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Chat does not exist",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        if context_row.chat_is_completed:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Chat has already been completed",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Rate limit validation
        requests_per_day = context_row.requests_per_day
        runs_today = context_row.runs_today or 0

        if requests_per_day is not None and runs_today >= requests_per_day:
            error_msg = (
                f"Rate limit exceeded ({runs_today}/{requests_per_day} requests today)"
            )
            logger.error(
                f"Attempt message rate limit exceeded - "
                f"profile_id={profile_id}, chat_id={data.chat_id}, "
                f"reason: {error_msg}"
            )
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Cannot send message: {error_msg}",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        attempt_id = context_row.attempt_id
        group_id = context_row.group_id

        # Step 2: get_attempt_websocket() → cached resources + views
        pool = get_pool()
        if not pool:
            raise RuntimeError("Database pool not initialized")

        async with pool.acquire() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=attempt_id,
            )

        if not result.resources:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Failed to fetch attempt data",
                    artifact_type="attempt",
                    group_id=str(group_id) if group_id else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Get agent_id from resource_agent_ids
        resource_agent_ids = result.resource_agent_ids or {}
        agent_id: uuid.UUID | None = resource_agent_ids.get("primary")

        if not agent_id:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent found for this attempt",
                    artifact_type="attempt",
                    group_id=str(group_id) if group_id else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Step 3: Extract LLM config from pre-fetched resources (Python, like grade.py)
        config_agents = result.resources.agents or []
        config_models = result.resources.models or []
        config_providers = result.resources.providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        # Validate: agent resource must exist
        if not agent_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="No agent configuration found. Check simulation settings.",
                    artifact_type="attempt",
                    group_id=str(group_id) if group_id else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Validate: model resource must exist
        if not model_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Agent '{agent_resource.name}' has no model configured",
                    artifact_type="attempt",
                    group_id=str(group_id) if group_id else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Validate: provider resource must exist
        if not provider_resource:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Model '{model_resource.name}' has no provider configured",
                    artifact_type="attempt",
                    group_id=str(group_id) if group_id else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Extract LLM config fields from resources
        model_name = (
            model_resource.value
            if hasattr(model_resource, "value")
            else model_resource.name
        )
        base_url = (
            provider_resource.endpoint if hasattr(provider_resource, "endpoint") else ""
        )
        api_key = provider_resource.key if hasattr(provider_resource, "key") else ""
        temperature = (
            agent_resource.temperature
            if hasattr(agent_resource, "temperature")
            else 0.0
        )
        reasoning = (
            agent_resource.reasoning if hasattr(agent_resource, "reasoning") else None
        )
        provider_name = provider_resource.value or provider_resource.name or ""

        # Validate: API key must exist
        if not api_key:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"No API key configured for provider '{provider_name}'",
                    artifact_type="attempt",
                    group_id=str(group_id) if group_id else None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        # Step 4: Determine effective_entry_types from hints_enabled
        hints_enabled = context_row.hints_enabled or False
        if hints_enabled:
            effective_entry_types = ATTEMPT_MESSAGE_ENTRY_TYPES
        else:
            effective_entry_types = [
                t for t in ATTEMPT_MESSAGE_ENTRY_TYPES if t != "hints"
            ]

        # Step 5: Parallel fetch tools, prompts, and instructions
        async def fetch_tools():
            async with pool.acquire() as c:
                tools_params = GetAgentEntryToolsSqlParams(
                    p_agent_id=agent_id,
                    p_entry_types=effective_entry_types,
                )
                tools_row = cast(
                    GetAgentEntryToolsSqlRow,
                    await execute_sql_typed(
                        c, SQL_PATH_AGENT_ENTRY_TOOLS, params=tools_params
                    ),
                )
                return tools_row.tools if tools_row else []

        async def fetch_system_prompt():
            prompt_id = (
                agent_resource.prompt_id
                if hasattr(agent_resource, "prompt_id")
                else None
            )
            if not prompt_id:
                return ""
            async with pool.acquire() as c:
                prompts = await get_prompts_internal(c, [prompt_id])
                if prompts and prompts[0].system_prompt:
                    return prompts[0].system_prompt
                return ""

        async def fetch_developer_instructions():
            instruction_ids = (
                agent_resource.instruction_ids
                if hasattr(agent_resource, "instruction_ids")
                else []
            )
            if not instruction_ids:
                return []
            async with pool.acquire() as c:
                instructions = await get_instructions_internal(c, instruction_ids)
                return [inst.template for inst in instructions if inst.template]

        (
            tools,
            system_prompt,
            developer_instruction_templates,
        ) = await asyncio.gather(
            fetch_tools(),
            fetch_system_prompt(),
            fetch_developer_instructions(),
        )

        # Step 6: Slim prepare SQL (mutations only, pass resolved resource IDs)
        async with get_db_connection() as conn:
            prepare_params = PrepareAttemptMessageSqlParams(
                p_profile_id=profile_id,
                p_chat_id=data.chat_id,
                p_message=message_str,
                p_voice_mode=data.voice_mode,
                p_upload_id=data.upload_id,
                p_group_id=data.group_id or group_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
            )

            prepare_row = cast(
                PrepareAttemptMessageSqlRow,
                await execute_sql_typed(conn, SQL_PATH_PREPARE, params=prepare_params),
            )

            if not prepare_row or not prepare_row.run_id:
                logger.error(
                    f"Attempt message preparation failed - "
                    f"profile_id={profile_id}, chat_id={data.chat_id}"
                )
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create message",
                        artifact_type="attempt",
                        group_id=str(group_id) if group_id else None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

        user_message_id = str(prepare_row.user_message_id)
        assistant_message_id = str(prepare_row.assistant_message_id)
        run_id = str(prepare_row.run_id)
        group_id_str = str(group_id) if group_id else None

        # Step 7: Build tool_meta from fetched tools + output schema queries
        tool_meta: dict[str, ToolStreamingMeta] = {}
        if tools:
            async with pool.acquire() as conn:
                for tool in tools:
                    if tool is None:
                        continue
                    # Tools from get_agent_entry_tools are typed objects
                    # tool_type maps to the entry type (e.g. 'contents', 'hints')
                    tool_id = tool.id if hasattr(tool, "id") else None
                    tool_name = tool.name if hasattr(tool, "name") else None
                    entry_type = tool.tool_type if hasattr(tool, "tool_type") else None
                    if (
                        not tool_id
                        or not tool_name
                        or not entry_type
                        or entry_type not in ENTRY_TYPE_DISPLAY_COLUMNS
                    ):
                        continue

                    # Find which argument maps to the display column
                    display_column = ENTRY_TYPE_DISPLAY_COLUMNS[entry_type]
                    display_arg: str | None = None
                    try:
                        output_rows = cast(
                            list[GetResourceOutputSchemaFieldsSqlRow],
                            await execute_sql_typed(
                                conn,
                                GET_OUTPUT_SCHEMA_FIELDS_SQL_PATH,
                                params=GetResourceOutputSchemaFieldsSqlParams(
                                    tool_id=tool_id
                                ),
                                multi_row=True,
                            ),
                        )
                        for row in output_rows or []:
                            if row.name == display_column and row.template:
                                display_arg = extract_template_variable_name(
                                    row.template
                                )
                                break
                    except Exception:
                        logger.warning(
                            f"Failed to resolve output schema for tool {tool_name}"
                        )

                    tool_meta[tool_name] = ToolStreamingMeta(
                        entry_type=entry_type,
                        display_arg=display_arg,
                    )

        # Step 8: Cache run context for streaming deltas (avoids DB query per delta)
        set_run_context(
            run_id, str(data.chat_id), assistant_message_id, tool_meta=tool_meta
        )

        # Step 9: Build Jinja context from pre-fetched data
        jinja_context = _build_attempt_jinja_context(result)

        # Inject views into jinja context for template access
        views_data: dict[str, Any] = {}
        if result.views:
            if result.views.simulation_attempts:
                views_data["simulation_attempts"] = [
                    a.model_dump(mode="json") for a in result.views.simulation_attempts
                ]
            if result.views.simulation_chats:
                views_data["simulation_chats"] = [
                    c.model_dump(mode="json") for c in result.views.simulation_chats
                ]
            if result.views.simulation_messages:
                views_data["simulation_messages"] = [
                    m.model_dump(mode="json") for m in result.views.simulation_messages
                ]
        jinja_context["views"] = views_data

        # Step 10: Render developer instructions with Jinja
        rendered_developer_messages = render_developer_instructions(
            templates=developer_instruction_templates,
            jinja_context=jinja_context,
        )

        # Step 11: Build model config
        if (
            data.voice_mode
            and agent_resource
            and hasattr(agent_resource, "voice")
            and agent_resource.voice
        ):
            model_config = {
                "model": model_name,
                "api_key": api_key,
                "base_url": base_url,
                "temperature": temperature,
                "reasoning": reasoning,
                "provider": provider_name,
                "voice": agent_resource.voice,
                "quality": agent_resource.quality
                if hasattr(agent_resource, "quality")
                else None,
                "length_seconds": None,
            }
            resource_type = "voice"
        else:
            model_config = {
                "model": model_name,
                "api_key": api_key,
                "base_url": base_url,
                "temperature": temperature,
                "reasoning": reasoning,
                "provider": provider_name,
                "voice": None,
                "quality": None,
                "length_seconds": None,
            }
            resource_type = "attempt"

        # Step 12: Build messages array
        messages: list[dict[str, str]] = []

        # Add system prompt
        if system_prompt:
            messages.append({"role": "system", "content": system_prompt})

        # Add rendered developer instructions
        for dm in rendered_developer_messages:
            messages.append({"role": "developer", "content": dm})

        # Add chat history from pre-fetched views
        if result.views and result.views.simulation_messages:
            for msg in result.views.simulation_messages:
                if (
                    msg.chat_id == data.chat_id
                    and msg.completed
                    and str(msg.id) != user_message_id
                    and str(msg.id) != assistant_message_id
                ):
                    role = "user" if msg.type == "query" else "assistant"
                    content = ""
                    if msg.contents:
                        content = msg.contents[0].content or ""
                    messages.append({"role": role, "content": content})

        # Add current user message
        messages.append({"role": "user", "content": message_str})

        # Step 13: Emit attempt_user_complete for the user message
        created_at_str = (
            prepare_row.created_at.isoformat() if prepare_row.created_at else ""
        )
        user_complete_event = AttemptUserCompleteEvent(
            chat_id=str(data.chat_id),
            message_id=user_message_id,
            content=message_str,
            created_at=created_at_str,
        )
        await sio.emit(
            "attempt_user_complete",
            user_complete_event.model_dump(mode="json"),
            room=sid,
        )
        # Also emit to attempt room for multi-tab sync
        await sio.emit(
            "attempt_user_complete",
            user_complete_event.model_dump(mode="json"),
            room=f"attempt_{data.chat_id}",
        )

        # Emit attempt_assistant_start for the assistant placeholder
        assistant_start_event = AttemptAssistantStartEvent(
            chat_id=str(data.chat_id),
            message_id=assistant_message_id,
            created_at=created_at_str,
        )
        await sio.emit(
            "attempt_assistant_start",
            assistant_start_event.model_dump(mode="json"),
            room=sid,
        )

        # Step 14: Emit to generate_artifact handler
        await internal_sio.emit(
            "generate_artifact",
            {
                "sid": sid,
                "artifact_type": "attempt",
                "resource_type": resource_type,
                "modality": "text",
                "run_id": run_id,
                "group_id": group_id_str,
                "messages": messages,
                "llm_config": model_config,
                "tools": convert_tools_to_dict(tools),
            },
        )

        logger.info(
            f"Attempt message sent - "
            f"profile_id={profile_id}, chat_id={data.chat_id}, "
            f"run_id={run_id}"
        )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in attempt_message: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid UUID format: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to send attempt message: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to send message: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def attempt_message(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_message event (client-to-server).

    Sends a user message during an active simulation.
    Emits attempt_message_sent on success, attempt_error on failure.
    """
    try:
        payload = AttemptMessagePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _attempt_message_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_message: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="attempt",
            ),
            sid=sid,
        )


@internal_sio.on("attempt_message")  # type: ignore
async def attempt_message_internal(data: dict[str, Any]) -> None:
    """Handle attempt_message event from internal bus (server-to-server)."""
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
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptMessagePayload(**data)
        await _attempt_message_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_message_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid request: {str(e)}",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="attempt",
                ),
                sid=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/message", response_model=dict[str, bool])
async def attempt_message_api(request: AttemptMessagePayload) -> dict[str, bool]:
    """Client-to-server event: Send a message during attempt simulation."""
    return {"success": True}


@server_router.post("/attempt/user_complete", response_model=dict[str, bool])
async def attempt_user_complete_api(
    request: AttemptUserCompleteEvent,
) -> dict[str, bool]:
    """Server-to-client event: User message finalized."""
    return {"success": True}


@server_router.post("/attempt/assistant_start", response_model=dict[str, bool])
async def attempt_assistant_start_api(
    request: AttemptAssistantStartEvent,
) -> dict[str, bool]:
    """Server-to-client event: Assistant message generation started."""
    return {"success": True}
