"""Handler for document_error WebSocket event - ONE EVENT PER FILE."""

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


class DocumentErrorPayload(BaseModel):
    """Response indicating an error occurred in Document tool."""

    success: bool
    message: str


async def _document_error_impl(
    sid: str,
    data: DocumentErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_document_error",
        data,
        room=sid,
    )


@internal_sio.on("document_error")  # type: ignore
async def document_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DocumentErrorPayload,
        handler=_document_error_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_document_error",
        error_response_type=DocumentErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/document_error",
    DocumentErrorPayload,
    "Error occurred in Document tool",
)
