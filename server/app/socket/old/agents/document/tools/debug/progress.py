"""Handler for debug_info_progress WebSocket event - ONE EVENT PER FILE."""

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


class DebugInfoProgressPayload(BaseModel):
    """Response indicating progress in DebugInfo tool."""

    type: str
    message: str | None = None


class DebugInfoErrorPayload(BaseModel):
    """Response indicating an error occurred in DebugInfo tool."""

    success: bool
    message: str


async def _debug_info_progress_impl(
    sid: str,
    data: DebugInfoProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "debug_info_progress",
        data,
        room=sid,
    )


@internal_sio.on("debug_info_progress")  # type: ignore
async def debug_info_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle debug_info_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DebugInfoProgressPayload,
        handler=_debug_info_progress_impl,  # type: ignore[arg-type]
        error_event_name="debug_info_error",
        error_response_type=DebugInfoErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/debug_info_progress",
    DebugInfoProgressPayload,
    "Progress update for DebugInfo tool",
)
