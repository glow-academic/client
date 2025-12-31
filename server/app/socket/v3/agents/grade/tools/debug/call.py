"""Handler for debug_info WebSocket event."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class DebugInfoToolPayload(BaseModel):
    """Request to output debug information."""

    info: str
    profile_id: str | None = None  # Deprecated - retrieved from sid
    sid: str | None = None


class DebugInfoToolCompletePayload(BaseModel):
    """Response indicating debug_info tool completed successfully."""

    success: bool
    message: str | None = None


class DebugInfoToolErrorPayload(BaseModel):
    """Response indicating an error occurred in debug_info tool."""

    success: bool
    message: str


async def _debug_info_impl(
    sid: str,
    data: DebugInfoToolPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for debug_info tool."""
    # Emit complete event via internal bus
    await emit_to_internal(
        "debug_info_complete",
        DebugInfoToolCompletePayload(
            success=True,
            message="Debug information logged successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("debug_info")  # type: ignore
async def debug_info_internal(data: dict[str, Any]) -> None:
    """Handle debug_info event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DebugInfoToolPayload,
        handler=_debug_info_impl,  # type: ignore[arg-type]
        error_event_name="debug_info_error",
        error_response_type=DebugInfoToolErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/debug_info",
    DebugInfoToolPayload,
    "Debug info tool handler",
)
