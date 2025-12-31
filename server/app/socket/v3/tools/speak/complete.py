"""Handler for speak_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from .call import (
    SpeakToolCompleteApiRequest,
    SpeakToolErrorSqlRow,
)

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _speak_complete_impl(
    sid: str,
    data: SpeakToolCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "speak_complete",
        data,
        room=sid,
    )


@internal_sio.on("speak_complete")  # type: ignore
async def speak_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle speak_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=SpeakToolCompleteApiRequest,
        handler=_speak_complete_impl,  # type: ignore[arg-type]
        error_event_name="speak_error",
        error_response_type=SpeakToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/speak_complete",
    SpeakToolCompleteApiRequest,
    "Speak tool completed successfully",
)

