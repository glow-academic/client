"""Handler for hint_complete WebSocket event - ONE EVENT PER FILE."""

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


class HintCompletePayload(BaseModel):
    """Response indicating Hint generation completed successfully."""

    success: bool
    message: str | None = None


class HintErrorPayload(BaseModel):
    """Response indicating an error occurred in Hint generation."""

    success: bool
    message: str


async def _hint_complete_impl(
    sid: str,
    data: HintCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulation_hints_complete",
        data,
        room=sid,
    )


@internal_sio.on("hint_complete")  # type: ignore
async def hint_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=HintCompletePayload,
        handler=_hint_complete_impl,  # type: ignore[arg-type]
        error_event_name="simulation_hints_error",
        error_response_type=HintErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_complete",
    HintCompletePayload,
    "Hint generation completed successfully",
)
