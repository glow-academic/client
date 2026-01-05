"""Handler for prompt_error WebSocket event - ONE EVENT PER FILE."""

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


class PromptErrorPayload(BaseModel):
    """Response indicating an error occurred in prompt agent operation."""

    success: bool
    message: str


async def _prompt_error_impl(
    sid: str,
    data: PromptErrorPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "prompt_error",
        data,
        room=sid,
    )


@internal_sio.on("prompt_error")  # type: ignore
async def prompt_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=PromptErrorPayload,
        handler=_prompt_error_impl,  # type: ignore[arg-type]
        error_event_name="prompt_error",
        error_response_type=PromptErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/prompt_error",
    PromptErrorPayload,
    "Error occurred in prompt agent operation",
)
