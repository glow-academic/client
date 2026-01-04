"""Handler for member_speak_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import MemberSpeakToolErrorSqlRow

internal_sio = get_internal_sio()
server_router = APIRouter()


class MemberSpeakProgressPayload(BaseModel):
    """Response indicating progress in Member speak tool."""

    type: str
    message: str | None = None


async def _member_speak_progress_impl(
    sid: str,
    data: MemberSpeakProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "member_speak_progress",
        data,
        room=sid,
    )


@internal_sio.on("member_speak_progress")  # type: ignore
async def member_speak_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_speak_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MemberSpeakProgressPayload,
        handler=_member_speak_progress_impl,  # type: ignore[arg-type]
        error_event_name="member_speak_error",
        error_response_type=MemberSpeakToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/member_speak_progress",
    MemberSpeakProgressPayload,
    "Progress update for Member speak tool",
)

