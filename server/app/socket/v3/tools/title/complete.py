"""Handler for title_complete WebSocket event - ONE EVENT PER FILE."""

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


class TitleToolCompletePayload(BaseModel):
    """Response indicating title tool completed successfully."""

    success: bool
    title: str
    trace_id: str
    message: str | None = None


class TitleToolErrorPayload(BaseModel):
    """Response indicating an error occurred in title tool."""

    success: bool
    message: str
    trace_id: str


async def _title_complete_impl(
    sid: str,
    data: TitleToolCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # Title tool already emits directly in call.py, so this is a no-op forwarder
    await emit_to_client(
        "title_complete",
        data,
        room=sid,
    )


@internal_sio.on("title_complete")  # type: ignore
async def title_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle title_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=TitleToolCompletePayload,
        handler=_title_complete_impl,  # type: ignore[arg-type]
        error_event_name="title_error",
        error_response_type=TitleToolErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/title_complete",
    TitleToolCompletePayload,
    "Title tool completed successfully",
)

