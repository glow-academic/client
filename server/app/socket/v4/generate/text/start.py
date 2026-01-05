"""Handler for generate_text_start WebSocket event - emits to client."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class TextGenerationStartPayload(BaseModel):
    """Payload for text generation start event."""

    sid: str
    resource_id: str | None
    resource_type: str | None
    run_id: str
    message: str


async def _generate_text_start_impl(
    sid: str,
    data: TextGenerationStartPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "text_generation_started",
        {
            "success": True,
            "message": data.message,
            "resource_id": data.resource_id,
            "resource_type": data.resource_type,
            "run_id": data.run_id,
        },
        room=sid,
    )


@internal_sio.on("generate_text_start")  # type: ignore
async def generate_text_start_internal(
    data: dict[str, Any],
) -> None:
    """Handle generate_text_start event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=TextGenerationStartPayload,
        handler=_generate_text_start_impl,  # type: ignore[arg-type]
        error_event_name="generate_text_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/generate_text_start",
    TextGenerationStartPayload,
    "Text generation started",
)

