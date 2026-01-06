"""Handler for classify_progress WebSocket event - ONE EVENT PER FILE."""

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


class ClassifyProgressPayload(BaseModel):
    """Response indicating progress in Classify generation."""

    type: str
    message: str | None = None


class ClassifyErrorPayload(BaseModel):
    """Response indicating an error occurred in Classify generation."""

    success: bool
    message: str


async def _classify_progress_impl(
    sid: str,
    data: ClassifyProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "uploads_classification_progress",
        data,
        room=sid,
    )


@internal_sio.on("classify_progress")  # type: ignore
async def classify_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle classify_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ClassifyProgressPayload,
        handler=_classify_progress_impl,  # type: ignore[arg-type]
        error_event_name="uploads_classification_error",
        error_response_type=ClassifyErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/classify_progress",
    ClassifyProgressPayload,
    "Progress update for Classify generation",
)
