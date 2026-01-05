"""Handler for member_regenerate_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import (
    MemberRegenerateToolCompleteApiRequest,
    MemberRegenerateToolErrorSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _member_regenerate_complete_impl(
    sid: str,
    data: MemberRegenerateToolCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "member_regenerate_complete",
        data,
        room=sid,
    )


@internal_sio.on("member_regenerate_complete")  # type: ignore
async def member_regenerate_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_regenerate_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=MemberRegenerateToolCompleteApiRequest,
        handler=_member_regenerate_complete_impl,  # type: ignore[arg-type]
        error_event_name="member_regenerate_error",
        error_response_type=MemberRegenerateToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/member_regenerate_complete",
    MemberRegenerateToolCompleteApiRequest,
    "Member regenerate tool completed successfully",
)
