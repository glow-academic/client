"""Attempt send message handler.

Handles the attempt_send WebSocket event - a simplified message sending flow.
Server looks up simulation_id and agent_id from chat_id.

This replaces the member_progress handler with a cleaner attempt_* event contract.
"""

import uuid
from typing import Any, cast

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
from app.socket.v4.artifacts.attempt.types import (
    AttemptAssistantStartEvent,
    AttemptSendPayload,
    AttemptUnifiedErrorEvent,
    AttemptUserCompleteEvent,
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


async def _attempt_send_impl(
    sid: str, data: AttemptSendPayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt_send with all business logic.

    This function:
    1. Validates payload and message content
    2. Determines chat type (general vs practice)
    3. Creates user message + assistant placeholder + run
    4. Emits attempt_user_complete and attempt_assistant_start events
    5. Gets simulation context for model config
    6. Routes through artifacts system for AI generation
    """
    try:
        message_str = data.content

        if not message_str or not message_str.strip():
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=str(data.chat_id),
                    type="send",
                    message="Missing or empty message",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        chat_id_uuid = data.chat_id

        async with get_db_connection() as conn:
            # Determine chat type (general vs practice)
            is_general_sql = load_sql(
                "app/sql/v4/queries/attempts/general/is_general_chat_complete.sql"
            )
            is_general_row = await conn.fetchrow(is_general_sql, chat_id_uuid)
            is_general = bool(is_general_row["is_general"]) if is_general_row else False

            if is_general:
                sql_path = "app/sql/v4/queries/attempts/general/member_progress_start_complete.sql"
            else:
                sql_path = "app/sql/v4/queries/attempts/practice/member_progress_start_complete.sql"

            sql = load_sql(sql_path)
            row = await conn.fetchrow(
                sql,
                chat_id_uuid,
                None,  # group_id
                message_str,
                data.voice_mode,
                data.upload_id,
            )

            if not row:
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        chat_id=str(data.chat_id),
                        type="send",
                        message="Failed to create message/run",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            user_message_id = str(row["user_message_id"])
            assistant_message_id = str(row["assistant_message_id"])
            run_id = str(row["run_id"])
            group_id = str(row["group_id"]) if row.get("group_id") else None
            created_at = row.get("created_at")
            audio = data.voice_mode

            # Emit attempt_user_complete for the user message
            user_complete_event = AttemptUserCompleteEvent(
                chat_id=str(chat_id_uuid),
                message_id=user_message_id,
                content=message_str,
                created_at=created_at.isoformat() if created_at else "",
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
                room=f"attempt_{chat_id_uuid}",
            )

            # Emit attempt_assistant_start for the assistant placeholder
            assistant_start_event = AttemptAssistantStartEvent(
                chat_id=str(chat_id_uuid),
                message_id=assistant_message_id,
                created_at=created_at.isoformat() if created_at else "",
            )
            await sio.emit(
                "attempt_assistant_start",
                assistant_start_event.model_dump(mode="json"),
                room=sid,
            )

            # Log activity
            try:
                await log_websocket_activity(
                    sid=sid,
                    event_key="attempt.send.message_sent",
                    template="{{ actor.name }} sent message via attempt_send",
                    context={"chat_id": str(chat_id_uuid), "audio": audio},
                    endpoint="/socket/v4/attempt/send",
                    error=False,
                )
            except Exception:
                pass

            # Get simulation context for model config + prompts
            context_params = GetSimulationRunContextSqlParams(chat_id=chat_id_uuid)
            context_result = cast(
                GetSimulationRunContextSqlRow,
                await execute_sql_typed(
                    conn,
                    "app/sql/v4/queries/simulations/get_simulation_run_context_complete.sql",
                    params=context_params,
                ),
            )

            if not context_result or not context_result.model_name:
                await sio.emit(
                    "attempt_error",
                    AttemptUnifiedErrorEvent(
                        chat_id=str(data.chat_id),
                        type="send",
                        message="Failed to get simulation model context",
                    ).model_dump(mode="json"),
                    room=sid,
                )
                return

            # Build model config based on voice mode
            if audio:
                resource_type = "voice"
                model_name = (
                    context_result.voice_model_name or context_result.model_name
                )
                api_key = context_result.voice_api_key or context_result.api_key
                base_url = context_result.voice_base_url or context_result.base_url
                temperature = (
                    context_result.voice_temperature
                    if context_result.voice_temperature is not None
                    else context_result.temperature
                )
                reasoning = context_result.voice_reasoning or context_result.reasoning
                provider = context_result.voice_provider or context_result.provider
                system_prompt = (
                    context_result.voice_system_prompt
                    or context_result.system_prompt
                    or ""
                )
            else:
                resource_type = "attempt"
                model_name = context_result.model_name
                api_key = context_result.api_key
                base_url = context_result.base_url
                temperature = context_result.temperature
                reasoning = context_result.reasoning
                provider = context_result.provider
                system_prompt = context_result.system_prompt or ""

            # Route through artifacts system
            await internal_sio.emit(
                "generate_artifact",
                {
                    "sid": sid,
                    "artifact_type": "attempt",
                    "resource_type": resource_type,
                    "modality": "text",
                    "run_id": run_id,
                    "group_id": str(group_id) if group_id else None,
                    "chat_id": str(chat_id_uuid),
                    "message_id": assistant_message_id,
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": message_str},
                    ],
                    "llm_config": {
                        "model": model_name,
                        "api_key": api_key,
                        "base_url": base_url,
                        "temperature": temperature,
                        "reasoning": reasoning,
                        "provider": provider,
                        "voice": None,
                        "quality": None,
                        "length_seconds": None,
                    },
                },
            )

            logger.info(
                f"Attempt send - profile_id={profile_id}, chat_id={chat_id_uuid}, "
                f"run_id={run_id}, message_id={assistant_message_id}"
            )

    except ValueError as e:
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(data.chat_id) if data else None,
                type="send",
                message=f"Invalid UUID format: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )
    except Exception as e:
        logger.exception(f"Failed to send attempt message: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(data.chat_id) if data else None,
                type="send",
                message=f"Failed to send message: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_send(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_send event (client-to-server).

    Sends a user message during an active attempt.
    Simplified payload - server looks up context from chat_id.
    """
    try:
        payload = AttemptSendPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=str(payload.chat_id),
                    type="send",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_send_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_send: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
                type="send",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/send", response_model=dict[str, bool])
async def attempt_send_api(request: AttemptSendPayload) -> dict[str, bool]:
    """Client-to-server event: Send a message during attempt simulation."""
    return {"success": True}


@server_router.post("/attempt/user_complete", response_model=dict[str, bool])
async def attempt_user_complete_api(request: AttemptUserCompleteEvent) -> dict[str, bool]:
    """Server-to-client event: User message finalized."""
    return {"success": True}


@server_router.post("/attempt/assistant_start", response_model=dict[str, bool])
async def attempt_assistant_start_api(request: AttemptAssistantStartEvent) -> dict[str, bool]:
    """Server-to-client event: Assistant message generation started."""
    return {"success": True}
