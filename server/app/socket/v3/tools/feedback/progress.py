"""Handler for feedback_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class FeedbackProgressPayload(BaseModel):
    """Response indicating progress in Feedback tool."""

    type: str
    message: str | None = None


class FeedbackErrorPayload(BaseModel):
    """Response indicating an error occurred in Feedback tool."""

    success: bool
    message: str


async def _feedback_progress_impl(
    sid: str,
    data: FeedbackProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "grading_tools_feedback_progress",
        data,
        room=sid,
    )


@internal_sio.on("feedback_progress")  # type: ignore
async def feedback_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle feedback_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=FeedbackProgressPayload,
        handler=_feedback_progress_impl,  # type: ignore[arg-type]
        error_event_name="grading_tools_feedback_error",
        error_response_type=FeedbackErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/feedback_progress",
    FeedbackProgressPayload,
    "Progress update for Feedback tool",
)
