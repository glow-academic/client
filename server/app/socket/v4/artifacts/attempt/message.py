"""Attempt simulation message handler.

Handles the attempt_message WebSocket event to send a message during simulation.
Creates user message + assistant placeholder, fetches context, and routes
to generate_artifact handler for AI response generation.

Entry types: ['messages', 'contents', 'hints'] - Message response tools
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.api.v4.artifacts.attempt.get import get_attempt_internal
from app.infra.v4.generation import convert_tools_to_dict, render_developer_instructions
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.permissions import (
    AttemptGenerationContext,
    format_generation_error,
    validate_attempt_message_access,
)
from app.socket.v4.artifacts.attempt.run_store import set_run_context
from app.socket.v4.artifacts.attempt.types import (
    ATTEMPT_MESSAGE_ENTRY_TYPES,
    AttemptAssistantStartEvent,
    AttemptMessagePayload,
    AttemptUserCompleteEvent,
)
from app.socket.v4.artifacts.types import GenerateErrorApiRequest
from app.sql.types import (
    GetAttemptMessageContextSqlParams,
    GetAttemptMessageContextSqlRow,
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


def _build_attempt_jinja_context(
    response: Any,
) -> dict[str, Any]:
    views = response.views.model_dump() if response.views else {}
    resources = response.resources.model_dump() if response.resources else {}

    return {
        "views": views,
        "resources": resources,
    }


async def _attempt_message_impl(
    sid: str, data: AttemptMessagePayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt message with all business logic.

    This function:
    1. Validates payload and message content
    2. Fetches context and validates prerequisites
    3. Creates user message + assistant placeholder + run
    4. Renders developer instructions with Jinja
    5. Builds messages array
    6. Emits attempt_message_sent event
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

        async with get_db_connection() as conn:
            # Step 1: Fetch context and validate prerequisites
            # Agent is resolved from pre-stored group (created at training start)
            context_params = GetAttemptMessageContextSqlParams(
                p_profile_id=profile_id,
                p_simulation_id=data.simulation_id,
                p_chat_id=data.chat_id,
                p_entry_types=ATTEMPT_MESSAGE_ENTRY_TYPES,
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

            # Build context dataclass for validation
            ctx = AttemptGenerationContext(
                # Base GenerationContext fields
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
                # Attempt-specific fields
                simulation_exists=context_row.simulation_exists or False,
                simulation_is_active=context_row.simulation_is_active or False,
                simulation_id=context_row.simulation_id,
                simulation_name=context_row.simulation_name,
                profile_has_access=context_row.profile_has_access or False,
                attempt_exists=context_row.attempt_exists or False,
                attempt_is_active=context_row.attempt_is_active or False,
                attempt_id=context_row.attempt_id,
                chat_exists=context_row.chat_exists or False,
                chat_is_completed=context_row.chat_is_completed or False,
                chat_id=context_row.chat_id,
                requested_entry_types=ATTEMPT_MESSAGE_ENTRY_TYPES,
                valid_entry_types=context_row.valid_entry_types or [],
            )

            # Build dynamic entry types based on hints_enabled
            hints_enabled = context_row.hints_enabled or False
            if hints_enabled:
                effective_entry_types = ATTEMPT_MESSAGE_ENTRY_TYPES
            else:
                effective_entry_types = [
                    t for t in ATTEMPT_MESSAGE_ENTRY_TYPES if t != "hints"
                ]

            # Validate using business logic
            is_valid, failures = validate_attempt_message_access(ctx)

            if not is_valid:
                error_msg = format_generation_error(failures)
                logger.error(
                    f"Attempt message validation failed - "
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

            # Step 2: Create user message + assistant placeholder + run
            prepare_params = PrepareAttemptMessageSqlParams(
                p_profile_id=profile_id,
                p_chat_id=data.chat_id,
                p_message=message_str,
                p_voice_mode=data.voice_mode,
                p_upload_id=data.upload_id,
                p_group_id=data.group_id,
                p_entry_types=effective_entry_types,
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
                        group_id=None,
                        resource_type="attempt",
                    ),
                    sid=sid,
                )
                return

            user_message_id = str(prepare_row.user_message_id)
            assistant_message_id = str(prepare_row.assistant_message_id)
            run_id = str(prepare_row.run_id)
            group_id = str(prepare_row.group_id) if prepare_row.group_id else None
            trace_id = prepare_row.trace_id

            # Cache run context for streaming deltas (avoids DB query per delta)
            set_run_context(run_id, str(data.chat_id), assistant_message_id)

            # Ensure MV is fresh before building developer context
            await conn.execute("REFRESH MATERIALIZED VIEW mv_attempt_messages")

            # Step 3: Build model config
            if data.voice_mode and prepare_row.voice_model_name:
                model_config = {
                    "model": prepare_row.voice_model_name,
                    "api_key": prepare_row.voice_api_key or prepare_row.api_key,
                    "base_url": prepare_row.voice_base_url or prepare_row.base_url,
                    "temperature": prepare_row.voice_temperature
                    if prepare_row.voice_temperature is not None
                    else prepare_row.temperature,
                    "reasoning": prepare_row.voice_reasoning or prepare_row.reasoning,
                    "provider": prepare_row.voice_provider or prepare_row.provider_name,
                    "voice": None,
                    "quality": None,
                    "length_seconds": None,
                }
                resource_type = "voice"
            else:
                model_config = {
                    "model": prepare_row.model_name,
                    "api_key": prepare_row.api_key,
                    "base_url": prepare_row.base_url,
                    "temperature": prepare_row.temperature,
                    "reasoning": prepare_row.reasoning,
                    "provider": prepare_row.provider_name,
                    "voice": None,
                    "quality": None,
                    "length_seconds": None,
                }
                resource_type = "attempt"

            # Step 4: Render developer instructions with Jinja
            attempt_response, _cache_hit = await get_attempt_internal(
                conn=conn,
                profile_id=profile_id,
                attempt_id=context_row.attempt_id,
                bypass_cache=True,
                cache_key_path="/api/v4/artifacts/attempt/get",
                http_request=None,
            )
            jinja_context = _build_attempt_jinja_context(attempt_response)

            rendered_developer_messages = render_developer_instructions(
                templates=prepare_row.developer_instruction_templates,
                jinja_context=jinja_context,
            )

            # Step 5: Build messages array
            messages: list[dict[str, str]] = []

            # Add system prompt
            if prepare_row.system_prompt:
                messages.append(
                    {"role": "system", "content": prepare_row.system_prompt}
                )

            # Add rendered developer instructions
            for dm in rendered_developer_messages:
                messages.append({"role": "developer", "content": dm})

            # Add chat history
            if prepare_row.chat_history:
                for hist in prepare_row.chat_history:
                    if isinstance(hist, dict):
                        messages.append(
                            {
                                "role": hist.get("role", "user"),
                                "content": hist.get("content", ""),
                            }
                        )

            # Add current user message
            messages.append({"role": "user", "content": message_str})

            # Step 6: Emit attempt_user_complete for the user message
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

            # Step 7: Emit to generate_artifact handler
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "attempt",
                    "resource_type": resource_type,
                    "modality": "text",
                    "run_id": run_id,
                    "group_id": group_id,
                    "messages": messages,
                    "llm_config": model_config,
                    "tools": convert_tools_to_dict(prepare_row.tools),
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
