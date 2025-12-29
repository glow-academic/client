"""Handler for grade_voice_error WebSocket event - ONE EVENT PER FILE."""

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


class GradeVoiceErrorPayload(BaseModel):
    """Response indicating an error occurred in Grade Voice generation."""

    success: bool
    message: str


async def _grade_voice_error_impl(
    sid: str,
    data: GradeVoiceErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_voice_grading_error",
        data,
        room=sid,
    )


@internal_sio.on("grade_voice_error")  # type: ignore
async def grade_voice_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle grade_voice_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=GradeVoiceErrorPayload,
        handler=_grade_voice_error_impl,  # type: ignore[arg-type]
        error_event_name="simulations_voice_grading_error",
        error_response_type=GradeVoiceErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/grade_voice_error",
    GradeVoiceErrorPayload,
    "Error occurred in Grade Voice generation",
)
