"""Handler for debug tool completion - emits to client."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class DebugToolCompletePayload(BaseModel):
    """Debug tool complete event payload."""

    sid: str
    resource_id: str | None = None
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    final_content: str
    arguments_raw: str


class DebugToolErrorPayload(BaseModel):
    """Error response for debug tool."""

    success: bool
    message: str


async def _debug_tool_complete_impl(
    sid: str,
    data: DebugToolCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle debug tool completion - emits to client."""
    await emit_to_client(
        "debug_info_complete",
        {
            "success": True,
            "message": "Debug info tool completed",
        },
        room=sid,
    )


@internal_sio.on("hint_debug_complete")  # type: ignore
async def hint_debug_complete_internal(data: dict[str, Any]) -> None:
    """Handle hint_debug_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=DebugToolCompletePayload,
        handler=_debug_tool_complete_impl,  # type: ignore[arg-type]
        error_event_name="hint_debug_error",
        error_response_type=DebugToolErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_debug_complete",
    DebugToolCompletePayload,
    "Debug tool completed successfully",
)

