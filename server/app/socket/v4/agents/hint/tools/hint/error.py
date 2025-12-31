"""Handler for hint_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import HintToolErrorSqlRow

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _hint_error_impl(
    sid: str,
    data: HintToolErrorSqlRow,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "hint_error",
        data,
        room=sid,
    )


@internal_sio.on("hint_error")  # type: ignore
async def hint_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=HintToolErrorSqlRow,
        handler=_hint_error_impl,  # type: ignore[arg-type]
        error_event_name="hint_error",
        error_response_type=HintToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/hint_error",
    HintToolErrorSqlRow,
    "Error occurred in Hint tool",
)
