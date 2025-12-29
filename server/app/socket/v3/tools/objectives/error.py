"""Handler for objectives_error WebSocket event - ONE EVENT PER FILE."""

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


class ObjectivesErrorPayload(BaseModel):
    """Response indicating an error occurred in Objectives tool."""

    success: bool
    message: str


async def _objectives_error_impl(
    sid: str,
    data: ObjectivesErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_objectives_error",
        data,
        room=sid,
    )


@internal_sio.on("objectives_error")  # type: ignore
async def objectives_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle objectives_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ObjectivesErrorPayload,
        handler=_objectives_error_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_objectives_error",
        error_response_type=ObjectivesErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/objectives_error",
    ObjectivesErrorPayload,
    "Error occurred in Objectives tool",
)
