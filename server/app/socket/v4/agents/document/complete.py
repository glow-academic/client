"""Handler for document_complete WebSocket event - ONE EVENT PER FILE."""

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


class DocumentCompletePayload(BaseModel):
    """Response indicating Document generation completed successfully."""

    success: bool
    message: str | None = None


class DocumentErrorPayload(BaseModel):
    """Response indicating an error occurred in Document generation."""

    success: bool
    message: str


async def _document_complete_impl(
    sid: str,
    data: DocumentCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "documents_complete",
        data,
        room=sid,
    )


@internal_sio.on("document_complete")  # type: ignore
async def document_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle document_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=DocumentCompletePayload,
        handler=_document_complete_impl,  # type: ignore[arg-type]
        error_event_name="documents_error",
        error_response_type=DocumentErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/document_complete",
    DocumentCompletePayload,
    "Document generation completed successfully",
)
