"""Handler for questions_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class QuestionsErrorPayload(BaseModel):
    """Response indicating an error occurred in Questions tool."""

    success: bool
    message: str


async def _questions_error_impl(
    sid: str,
    data: QuestionsErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_questions_error",
        data,
        room=sid,
    )


@internal_sio.on("questions_error")  # type: ignore
async def questions_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle questions_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=QuestionsErrorPayload,
        handler=_questions_error_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_questions_error",
        error_response_type=QuestionsErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/questions_error",
    QuestionsErrorPayload,
    "Error occurred in Questions tool",
)
