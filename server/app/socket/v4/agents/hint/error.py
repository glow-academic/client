"""Handler for hint_error WebSocket event - emits final client error event."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class HintErrorPayload(BaseModel):
    """Error response for hint generation."""

    success: bool
    message: str
    resource_id: str | None = None
    group_id: str | None = None


async def _hint_error_impl(
    sid: str,
    data: HintErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulation_hints_error",
        {
            "success": data.success,
            "message": data.message,
            "chat_id": data.resource_id,
        },
        room=sid,
    )


@internal_sio.on("hint_error")  # type: ignore
async def hint_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=HintErrorPayload,
        handler=_hint_error_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=HintErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_error",
    HintErrorPayload,
    "Error occurred in hint generation",
)

