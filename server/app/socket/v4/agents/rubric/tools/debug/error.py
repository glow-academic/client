"""Handler for debug_info_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class DebugInfoErrorPayload(BaseModel):
    """Response indicating an error occurred in DebugInfo tool."""

    success: bool
    message: str


async def _debug_info_error_impl(
    sid: str,
    data: DebugInfoErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "debug_info_error",
        data,
        room=sid,
    )


@internal_sio.on("debug_info_error")  # type: ignore
async def debug_info_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle debug_info_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DebugInfoErrorPayload,
        handler=_debug_info_error_impl,  # type: ignore[arg-type]
        error_event_name="debug_info_error",
        error_response_type=DebugInfoErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/debug_info_error",
    DebugInfoErrorPayload,
    "Error occurred in DebugInfo tool",
)
