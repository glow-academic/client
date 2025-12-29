"""Handler for hint_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class HintProgressPayload(BaseModel):
    """Response indicating progress in Hint generation."""

    type: str
    message: str | None = None


class HintErrorPayload(BaseModel):
    """Response indicating an error occurred in Hint generation."""

    success: bool
    message: str


async def _hint_progress_impl(
    sid: str,
    data: HintProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulation_hints_progress",
        data,
        room=sid,
    )


@internal_sio.on("hint_progress")  # type: ignore
async def hint_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=HintProgressPayload,
        handler=_hint_progress_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=HintErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_progress",
    HintProgressPayload,
    "Progress update for Hint generation",
)
