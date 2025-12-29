"""Handler for classify_error WebSocket event - ONE EVENT PER FILE."""

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


class ClassifyErrorPayload(BaseModel):
    """Response indicating an error occurred in Classify generation."""

    success: bool
    message: str


async def _classify_error_impl(
    sid: str,
    data: ClassifyErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "uploads_classification_error",
        data,
        room=sid,
    )


@internal_sio.on("classify_error")  # type: ignore
async def classify_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle classify_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ClassifyErrorPayload,
        handler=_classify_error_impl,  # type: ignore[arg-type]
        error_event_name="uploads_classification_error",
        error_response_type=ClassifyErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/classify_error",
    ClassifyErrorPayload,
    "Error occurred in Classify generation",
)
