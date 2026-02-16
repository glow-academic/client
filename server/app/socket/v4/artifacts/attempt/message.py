"""Attempt simulation message handler — thin wrapper.

Handles the attempt_message WebSocket event to send a message during simulation.
Validates context, creates user message + assistant placeholder via prepare SQL,
emits client events, then delegates to attempt_generate for the LLM pipeline.

Entry types: ['contents', 'hints'] - Message response tools
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio, sio
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


async def _attempt_message_impl(
    sid: str, data: AttemptMessagePayload, profile_id: uuid.UUID
) -> None:
    """Thin wrapper: validate, prepare, emit client events, delegate to attempt_generate."""
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

        # 1. Context SQL — validate access, rate limits, chat state
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

        # 2. Determine entry_types from hints_enabled
        hints_enabled = context_row.hints_enabled or False
        if hints_enabled:
            effective_entry_types = ATTEMPT_MESSAGE_ENTRY_TYPES
        else:
            effective_entry_types = [
                t for t in ATTEMPT_MESSAGE_ENTRY_TYPES if t != "hints"
            ]

        # 3. Prepare SQL — create user message + assistant placeholder
        async with get_db_connection() as conn:
            prepare_params = PrepareAttemptMessageSqlParams(
                p_profile_id=profile_id,
                p_chat_id=data.chat_id,
                p_message=message_str,
                p_voice_mode=data.voice_mode,
                p_upload_id=data.upload_id,
                p_group_id=data.group_id or group_id,
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

        # 4. Emit user_complete + assistant_start to client
        user_message_id = str(prepare_row.user_message_id)
        assistant_message_id = str(prepare_row.assistant_message_id)
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

        # 5. Delegate to attempt_generate
        await internal_sio.emit(
            "attempt_generate",
            {
                "sid": sid,
                "attempt_id": str(attempt_id),
                "entry_types": effective_entry_types,
                "run_id": str(prepare_row.run_id),
                "group_id": str(group_id),
                "chat_id": str(data.chat_id),
            },
        )

        logger.info(
            f"Attempt message sent - "
            f"profile_id={profile_id}, chat_id={data.chat_id}, "
            f"run_id={prepare_row.run_id}"
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
    """Handle attempt_message event (client-to-server)."""
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
