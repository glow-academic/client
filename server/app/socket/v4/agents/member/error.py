"""Handler for member_error WebSocket event - ONE EVENT PER FILE."""

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


class MemberErrorPayload(BaseModel):
    """Response indicating an error occurred in member agent operation."""

    success: bool
    message: str


async def _member_error_impl(
    sid: str,
    data: MemberErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "member_error",
        data,
        room=sid,
    )


@internal_sio.on("member_error")  # type: ignore
async def member_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MemberErrorPayload,
        handler=_member_error_impl,  # type: ignore[arg-type]
        error_event_name="member_error",
        error_response_type=MemberErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/member_error",
    MemberErrorPayload,
    "Error occurred in member agent operation",
)
