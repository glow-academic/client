"""Internal attempt_message handler — owns message handling logic.

Handles: @internal_sio.on("attempt_message")

Flow: Fetch attempt → validate chat → prepare message SQL → emit sync events
(attempt_user_complete, attempt_assistant_start) → build chat history →
emit "generate" to trigger LLM response via the generation pipeline.
"""

import uuid
from typing import Any, cast

from app.api.v4.artifacts.attempt.get import get_attempt_websocket
from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio
from app.socket.v5.client.types import AttemptMessagePayload
from app.socket.v5.internal.attempt.types import (
    AttemptAssistantStartData,
    AttemptErrorData,
    AttemptUserCompleteData,
    GenerateRequestData,
)
from app.sql.types import PrepareAttemptMessageSqlParams, PrepareAttemptMessageSqlRow
from app.utils.logging.db_logger import get_logger
from app.utils.sql_helper import execute_sql_typed

logger = get_logger(__name__)

internal_sio = get_internal_sio()

SQL_PATH_PREPARE_MESSAGE = (
    "app/sql/v4/queries/generate/attempt/prepare_attempt_message_complete.sql"
)


@internal_sio.on("attempt_message")  # type: ignore
async def attempt_message_handler(data: dict[str, Any]) -> None:
    """Handle attempt_message — persist user msg, emit sync events, compose."""
    sid = data.get("sid", "")
    if not sid:
        return

    # Resolve profile_id (passed from client, or fallback to socket lookup)
    profile_id_str = data.get("profile_id") or await find_profile_by_socket(sid)
    if not profile_id_str:
        return

    try:
        profile_id = uuid.UUID(profile_id_str)
        payload = AttemptMessagePayload(**data)
    except Exception as e:
        logger.exception(f"Invalid attempt_message payload: {e}")
        return

    try:
        attempt_id = payload.attempt_id
        chat_id = payload.chat_id
        message = payload.message

        # Step 1: Validate message
        if not message or not message.strip():
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Missing or empty message",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 2: Fetch attempt data (includes chat state + resources)
        async with get_db_connection() as conn:
            result = await get_attempt_websocket(
                conn=conn,
                profile_id=profile_id,
                attempt_id=attempt_id,
            )

        if not result.resources:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Attempt not found or access denied",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 3: Validate chat exists and is not completed
        chat_valid = False
        if result.views and result.views.attempt_chat:
            for chat in result.views.attempt_chat:
                if chat.id == chat_id:
                    if chat.completed:
                        await internal_sio.emit(
                            "attempt_error",
                            AttemptErrorData(
                                sid=sid,
                                error_type="send",
                                message="Chat has already been completed",
                                chat_id=str(chat_id),
                            ).model_dump(mode="json"),
                        )
                        return
                    chat_valid = True
                    break

        if not chat_valid:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Chat does not exist",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        # Step 4: Extract agent/model/provider resource IDs
        config_agents = result.resources.config_agents or []
        config_models = result.resources.config_models or []
        config_providers = result.resources.config_providers or []

        agent_resource = config_agents[0] if config_agents else None
        model_resource = config_models[0] if config_models else None
        provider_resource = config_providers[0] if config_providers else None

        if not agent_resource or not model_resource or not provider_resource:
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Missing agent/model/provider configuration",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        existing_group_id = result.group_id

        # Step 5: Prepare message SQL (creates user msg + assistant placeholder + run)
        async with get_db_connection() as conn:
            msg_prepare_params = PrepareAttemptMessageSqlParams(
                p_profile_id=profile_id,
                p_chat_id=chat_id,
                p_message=message,
                p_voice_mode=payload.voice_mode,
                p_upload_id=payload.upload_id,
                p_group_id=existing_group_id,
                p_agents_resource_id=agent_resource.id,
                p_models_resource_id=model_resource.id,
                p_providers_resource_id=provider_resource.id,
            )
            msg_prepare_row = cast(
                PrepareAttemptMessageSqlRow,
                await execute_sql_typed(
                    conn, SQL_PATH_PREPARE_MESSAGE, params=msg_prepare_params
                ),
            )

        if not msg_prepare_row or not msg_prepare_row.run_id:
            logger.error(
                f"Attempt message preparation failed - "
                f"profile_id={profile_id}, chat_id={chat_id}"
            )
            await internal_sio.emit(
                "attempt_error",
                AttemptErrorData(
                    sid=sid,
                    error_type="send",
                    message="Failed to create message",
                    chat_id=str(chat_id),
                ).model_dump(mode="json"),
            )
            return

        created_at_str = (
            msg_prepare_row.created_at.isoformat() if msg_prepare_row.created_at else ""
        )

        # Step 6: Emit attempt_user_complete (to sid + attempt room)
        await internal_sio.emit(
            "attempt_user_complete",
            AttemptUserCompleteData(
                sid=sid,
                rooms=[sid, f"attempt_{chat_id}"],
                chat_id=str(chat_id),
                message_id=str(msg_prepare_row.user_message_id),
                content=message,
                created_at=created_at_str,
            ).model_dump(mode="json"),
        )

        # Step 7: Emit attempt_assistant_start (to sid)
        await internal_sio.emit(
            "attempt_assistant_start",
            AttemptAssistantStartData(
                sid=sid,
                chat_id=str(chat_id),
                message_id=str(msg_prepare_row.assistant_message_id),
                created_at=created_at_str,
            ).model_dump(mode="json"),
        )

        # Step 8: Build chat history from views (completed messages for this chat)
        extra_messages: list[dict[str, str]] = []
        if result.views and result.views.attempt_message:
            for msg in result.views.attempt_message:
                if msg.chat_id == chat_id and msg.completed:
                    role = "user" if msg.type == "query" else "assistant"
                    content = ""
                    if msg.contents:
                        content = msg.contents[0].content or ""
                    extra_messages.append({"role": role, "content": content})

        # Step 9: Emit to generate pipeline (pre-created run_id skips prepare)
        resource_types = payload.resource_types or ["contents", "hints"]

        await internal_sio.emit(
            "generate",
            GenerateRequestData(
                sid=sid,
                profile_id=str(profile_id),
                artifact_type="attempt",
                artifact_id=str(attempt_id),
                resource_types=resource_types,
                user_instructions=payload.user_instructions,
                save=True,
                attempt_id=str(attempt_id),
                run_id=str(msg_prepare_row.run_id),
                group_id=str(existing_group_id) if existing_group_id else None,
                chat_id=str(chat_id),
                extra_messages=extra_messages if extra_messages else None,
            ).model_dump(mode="json"),
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.message.sent",
                template="{{ actor.name }} sent a message",
                context={"chat_id": str(chat_id)},
                endpoint="/socket/v5/attempt/message",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_message: {e}")
        await internal_sio.emit(
            "attempt_error",
            AttemptErrorData(
                sid=sid,
                error_type="send",
                message=f"Failed to send message: {e}",
                chat_id=str(payload.chat_id) if payload.chat_id else None,
            ).model_dump(mode="json"),
        )
