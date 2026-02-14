"""Attempt response handlers for video question submissions.

Handles WebSocket events for quiz/video question responses:
- attempt_response_submit: Submit an answer to a video question
"""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.infra.v4.websocket.attempt.types import (
    AttemptResponseResultEvent,
    AttemptResponseSubmitPayload,
    AttemptUnifiedErrorEvent,
)
from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.main import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


async def _attempt_response_submit_impl(
    sid: str, data: AttemptResponseSubmitPayload, profile_id: uuid.UUID
) -> None:
    """Handle attempt_response_submit - submit a video question response.

    NOTE: This is a placeholder implementation. The actual database operations
    for storing question responses need to be implemented with proper schema.
    """
    try:
        chat_id = str(data.chat_id)
        question_id = str(data.question_id)
        option_ids = [str(oid) for oid in data.option_ids]

        if not chat_id or not question_id or not option_ids:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=chat_id,
                    type="quiz",
                    message="Missing required fields",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        # TODO: Implement database operations for storing question responses
        # For now, emit success without database check
        logger.info(
            f"Quiz response received - chat_id={chat_id}, "
            f"question_id={question_id}, option_ids={option_ids}"
        )

        # Emit success event (placeholder - actual correctness check needs implementation)
        event = AttemptResponseResultEvent(
            success=True,
            message="Response submitted",
            is_correct=None,  # Will be populated when DB check is implemented
            all_correct=None,
        )

        await sio.emit(
            "attempt_response_result",
            event.model_dump(mode="json"),
            room=sid,
        )

        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="attempt.response.submitted",
                template="{{ actor.name }} submitted quiz response",
                context={"chat_id": chat_id, "question_id": question_id},
                endpoint="/socket/v4/attempt/response_submit",
                error=False,
            )
        except Exception:
            pass

    except Exception as e:
        logger.exception(f"Error in attempt_response_submit: {str(e)}")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(data.chat_id) if data else None,
                type="quiz",
                message=f"Failed to submit response: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


@sio.event  # type: ignore
async def attempt_response_submit(sid: str, data: dict[str, Any]) -> None:
    """Handle attempt_response_submit event - submit a video question response."""
    try:
        payload = AttemptResponseSubmitPayload(**data)
        profile_id_str = await find_profile_by_socket(sid)

        if not profile_id_str:
            await sio.emit(
                "attempt_error",
                AttemptUnifiedErrorEvent(
                    chat_id=str(payload.chat_id),
                    type="quiz",
                    message="Profile not found. Please reconnect.",
                ).model_dump(mode="json"),
                room=sid,
            )
            return

        profile_id = uuid.UUID(profile_id_str)
        await _attempt_response_submit_impl(sid, payload, profile_id)

    except Exception as e:
        logger.exception(f"Invalid request in attempt_response_submit: {str(e)}")
        chat_id = data.get("chat_id", "")
        await sio.emit(
            "attempt_error",
            AttemptUnifiedErrorEvent(
                chat_id=str(chat_id) if chat_id else None,
                type="quiz",
                message=f"Invalid request: {str(e)}",
            ).model_dump(mode="json"),
            room=sid,
        )


# =============================================================================
# FastAPI endpoints for OpenAPI documentation
# =============================================================================


@client_router.post("/attempt/response_submit", response_model=dict[str, bool])
async def attempt_response_submit_api(
    request: AttemptResponseSubmitPayload,
) -> dict[str, bool]:
    """Client-to-server event: Submit a video question response."""
    return {"success": True}


@server_router.post("/attempt/response_result", response_model=dict[str, bool])
async def attempt_response_result_api(
    request: AttemptResponseResultEvent,
) -> dict[str, bool]:
    """Server-to-client event: Response submission result."""
    return {"success": True}
