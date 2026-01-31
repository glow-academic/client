"""Simulation attempt generation router - unified handler for simulation chat messages.

This module handles all business logic for simulation attempt generation:
- Payload validation
- User message + assistant placeholder creation
- Context fetching (model config, prompts, tools, chat history)
- Developer instruction rendering
- Message array building
- Routing to generate_artifact handler

The AI handler receives a simplified payload with pre-rendered content.
"""

import uuid
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.socket.v4.attempts.simulation.types import (
    AttemptGeneratePayload,
    AttemptStartedEvent,
)
from app.sql.types import (
    GetSimulationRunContextSqlParams,
    GetSimulationRunContextSqlRow,
)
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed, load_sql

logger = get_logger(__name__)

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


# SQL paths
SQL_PATH_IS_GENERAL = "app/sql/v4/queries/attempts/general/is_general_chat_complete.sql"
SQL_PATH_PRACTICE_START = (
    "app/sql/v4/queries/attempts/practice/member_progress_start_complete.sql"
)
SQL_PATH_GENERAL_START = (
    "app/sql/v4/queries/attempts/general/member_progress_start_complete.sql"
)
SQL_PATH_SIMULATION_CONTEXT = (
    "app/sql/v4/queries/simulations/get_simulation_run_context_complete.sql"
)


@dataclass
class AttemptGenerationContext:
    """Context for attempt generation.

    Contains all data needed to generate an attempt response.
    TODO: This will be populated from an API endpoint when ready.
    """

    # Run/Group identifiers
    run_id: uuid.UUID | None = None
    group_id: uuid.UUID | None = None
    trace_id: str | None = None

    # Model config (text mode)
    model_name: str | None = None
    api_key: str | None = None
    base_url: str | None = None
    temperature: float | None = None
    reasoning: str | None = None
    provider: str | None = None

    # Model config (voice mode)
    voice_model_name: str | None = None
    voice_api_key: str | None = None
    voice_base_url: str | None = None
    voice_temperature: float | None = None
    voice_reasoning: str | None = None
    voice_provider: str | None = None

    # Agent context
    agent_id: uuid.UUID | None = None
    system_prompt: str | None = None

    # Tools (array of tool definitions)
    tools: list[Any] | None = None

    # Developer instructions (array of Jinja templates)
    developer_instruction_templates: list[str] | None = None

    # Jinja context (for rendering developer instructions)
    jinja_context: dict[str, Any] | None = None

    # Chat history (previous messages in this conversation)
    chat_history: list[dict[str, Any]] | None = None


async def get_attempt_generation_context(
    conn: Any,
    chat_id: uuid.UUID,
    run_id: uuid.UUID | None = None,
) -> AttemptGenerationContext:
    """Fetch context needed for attempt generation.

    TODO: This will be replaced with an API endpoint call when ready.
    For now, uses the existing get_simulation_run_context SQL.

    Args:
        conn: Database connection
        chat_id: The chat ID to fetch context for
        run_id: Optional run ID (not used currently, for future use)

    Returns:
        AttemptGenerationContext with model config and prompts
    """
    context_params = GetSimulationRunContextSqlParams(chat_id=chat_id)
    context_result = cast(
        GetSimulationRunContextSqlRow,
        await execute_sql_typed(
            conn,
            SQL_PATH_SIMULATION_CONTEXT,
            params=context_params,
        ),
    )

    if not context_result:
        return AttemptGenerationContext()

    # TODO: Fetch tools, developer_instruction_templates, jinja_context,
    # chat_history from API endpoint when ready

    return AttemptGenerationContext(
        # Text mode model config
        model_name=context_result.model_name,
        api_key=context_result.api_key,
        base_url=context_result.base_url,
        temperature=context_result.temperature,
        reasoning=context_result.reasoning,
        provider=context_result.provider,
        system_prompt=context_result.system_prompt,
        # Voice mode model config
        voice_model_name=context_result.voice_model_name,
        voice_api_key=context_result.voice_api_key,
        voice_base_url=context_result.voice_base_url,
        voice_temperature=context_result.voice_temperature,
        voice_reasoning=context_result.voice_reasoning,
        voice_provider=context_result.voice_provider,
        # TODO: These will come from the API endpoint
        tools=None,
        developer_instruction_templates=None,
        jinja_context=None,
        chat_history=None,
        trace_id=None,
    )


async def _attempt_generate_impl(
    sid: str, data: AttemptGeneratePayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt generation with all business logic.

    This function:
    1. Validates payload
    2. Determines chat type (general vs practice)
    3. Creates user message + assistant placeholder + run via SQL
    4. Fetches full context (model config, prompts, tools, history)
    5. Renders developer instructions with Jinja
    6. Builds messages array
    7. Emits to generate_artifact handler
    """
    try:
        chat_id = data.chat_id
        message_str = data.message

        if not message_str or not message_str.strip():
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Missing or empty message",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        async with get_db_connection() as conn:
            # Step 1: Determine chat type (general vs practice)
            is_general_sql = load_sql(SQL_PATH_IS_GENERAL)
            is_general_row = await conn.fetchrow(is_general_sql, chat_id)
            is_general = bool(is_general_row["is_general"]) if is_general_row else False

            sql_path = SQL_PATH_GENERAL_START if is_general else SQL_PATH_PRACTICE_START

            # Step 2: Create user message + assistant placeholder + run
            sql = load_sql(sql_path)
            row = await conn.fetchrow(
                sql,
                chat_id,
                uuid.UUID(str(data.group_id)) if data.group_id else None,
                message_str,
                data.voice_mode,
                uuid.UUID(str(data.upload_id)) if data.upload_id else None,
            )

            if not row:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to create message/run",
                        artifact_type="attempt",
                        group_id=None,
                        resource_type="simulation",
                    ),
                    sid=sid,
                )
                return

            user_message_id = str(row["user_message_id"])
            assistant_message_id = str(row["assistant_message_id"])
            run_id = str(row["run_id"])
            group_id = str(row["group_id"]) if row.get("group_id") else None
            created_at = row.get("created_at")

            # Emit user message sent events for UI synchronization
            await sio.emit(
                "simulation_text_message_sent",
                {
                    "message_id": user_message_id,
                    "chat_id": str(chat_id),
                    "message": message_str,
                    "created_at": created_at.isoformat() if created_at else "",
                },
                room=f"simulation_{chat_id}",
            )
            await sio.emit(
                "simulation_text_new_message",
                {
                    "message_id": user_message_id,
                    "chat_id": str(chat_id),
                    "role": "user",
                    "content": message_str,
                    "completed": True,
                    "created_at": created_at.isoformat() if created_at else "",
                },
                room=f"simulation_{chat_id}",
            )

            # Step 3: Fetch full context
            context = await get_attempt_generation_context(
                conn, chat_id, uuid.UUID(run_id)
            )

            if not context.model_name:
                await emit_to_internal(
                    "generate_call_error",
                    GenerateErrorApiRequest(
                        sid=sid,
                        error_message="Failed to get simulation model context",
                        artifact_type="attempt",
                        group_id=group_id,
                        resource_type="simulation",
                    ),
                    sid=sid,
                )
                return

            # Step 4: Select model config based on voice_mode
            if data.voice_mode:
                model_config = {
                    "model": context.voice_model_name or context.model_name,
                    "api_key": context.voice_api_key or context.api_key,
                    "base_url": context.voice_base_url or context.base_url,
                    "temperature": context.voice_temperature
                    if context.voice_temperature is not None
                    else context.temperature,
                    "reasoning": context.voice_reasoning or context.reasoning,
                    "provider": context.voice_provider or context.provider,
                    "voice": None,
                    "quality": None,
                    "length_seconds": None,
                }
                resource_type = "voice"
            else:
                model_config = {
                    "model": context.model_name,
                    "api_key": context.api_key,
                    "base_url": context.base_url,
                    "temperature": context.temperature,
                    "reasoning": context.reasoning,
                    "provider": context.provider,
                    "voice": None,
                    "quality": None,
                    "length_seconds": None,
                }
                resource_type = "simulation"

            # Step 5: Render developer instructions with Jinja
            # TODO: When API endpoint is ready, this will use real templates
            rendered_developer_messages = render_developer_instructions(
                templates=context.developer_instruction_templates,
                jinja_context=context.jinja_context,
            )

            # Step 6: Build messages array
            messages: list[dict[str, str]] = []

            # Add system prompt
            if context.system_prompt:
                messages.append({"role": "system", "content": context.system_prompt})

            # Add rendered developer instructions
            for dm in rendered_developer_messages:
                messages.append({"role": "developer", "content": dm})

            # Add chat history
            # TODO: When API endpoint is ready, this will include full chat history
            if context.chat_history:
                for hist in context.chat_history:
                    messages.append(
                        {"role": hist.get("role", "user"), "content": hist.get("content", "")}
                    )

            # Add current user message
            messages.append({"role": "user", "content": message_str})

            # Step 7: Emit attempt_started event
            started_event = AttemptStartedEvent(
                chat_id=str(chat_id),
                message_id=assistant_message_id,
                run_id=run_id,
                group_id=group_id,
            )
            await sio.emit(
                "attempt_started",
                started_event.model_dump(mode="json"),
                room=sid,
            )

            # Step 8: Emit to generate_artifact handler
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "attempt",
                    "resource_type": resource_type,
                    "modality": "text",
                    "run_id": run_id,
                    "group_id": group_id,
                    "chat_id": str(chat_id),
                    "message_id": assistant_message_id,
                    "messages": messages,
                    "llm_config": model_config,
                    "tools": convert_tools_to_dict(context.tools),
                    "metadata": {"trace_id": context.trace_id},
                    "eval_mode": False,
                },
            )

    except ValueError as e:
        logger.exception(f"Invalid UUID format in attempt_generate: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid UUID format: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="simulation",
            ),
            sid=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to generate attempt: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Failed to generate attempt: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="simulation",
            ),
            sid=sid,
        )


@sio.event  # type: ignore
async def attempt_generate(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_generate event (client-to-server)."""
    try:
        payload = AttemptGeneratePayload(**data)
        profile_id_str = await find_profile_by_socket(sid)
        if not profile_id_str:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message="Profile not found. Please reconnect.",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return
        profile_id = uuid.UUID(profile_id_str)
        await _attempt_generate_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_generate: {str(e)}")
        await emit_to_internal(
            "generate_call_error",
            GenerateErrorApiRequest(
                sid=sid,
                error_message=f"Invalid request: {str(e)}",
                artifact_type="attempt",
                group_id=None,
                resource_type="simulation",
            ),
            sid=sid,
        )


@internal_sio.on("attempt_generate")  # type: ignore
async def attempt_generate_internal(data: dict[str, Any]) -> None:
    """Handle attempt_generate event from internal bus (server-to-server)."""
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
                    resource_type="simulation",
                ),
                sid=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptGeneratePayload(**data)
        await _attempt_generate_impl(sid, payload, profile_id)
    except Exception as e:
        logger.exception(f"Invalid request in attempt_generate_internal: {str(e)}")
        sid = data.get("sid", "")
        if sid:
            await emit_to_internal(
                "generate_call_error",
                GenerateErrorApiRequest(
                    sid=sid,
                    error_message=f"Invalid request: {str(e)}",
                    artifact_type="attempt",
                    group_id=None,
                    resource_type="simulation",
                ),
                sid=sid,
            )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/generate", response_model=dict[str, bool])
async def attempt_generate_api(request: AttemptGeneratePayload) -> dict[str, bool]:
    """Client-to-server event: Generate attempt response from user message."""
    return {"success": True}


@server_router.post("/attempt/started", response_model=dict[str, bool])
async def attempt_started_api(request: AttemptStartedEvent) -> dict[str, bool]:
    """Server-to-client event: New assistant message placeholder created."""
    return {"success": True}
