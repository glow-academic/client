"""Handler for speak_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import SpeakToolErrorSqlRow

internal_sio = get_internal_sio()
server_router = APIRouter()


class SpeakProgressPayload(BaseModel):
    """Response indicating progress in Speak tool."""

    type: str
    message: str | None = None


async def _speak_progress_impl(
    sid: str,
    data: SpeakProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "speak_progress",
        data,
        room=sid,
    )


@internal_sio.on("speak_progress")  # type: ignore
async def speak_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle speak_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SpeakProgressPayload,
        handler=_speak_progress_impl,  # type: ignore[arg-type]
        error_event_name="speak_error",
        error_response_type=SpeakToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/speak_progress",
    SpeakProgressPayload,
    "Progress update for Speak tool",
)
