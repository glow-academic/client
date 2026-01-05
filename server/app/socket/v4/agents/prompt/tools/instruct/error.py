"""Handler for prompt_instruct_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import PromptInstructToolErrorSqlRow

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _prompt_instruct_error_impl(
    sid: str,
    data: PromptInstructToolErrorSqlRow,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "prompt_instruct_error",
        data,
        room=sid,
    )


@internal_sio.on("prompt_instruct_error")  # type: ignore
async def prompt_instruct_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle prompt_instruct_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=PromptInstructToolErrorSqlRow,
        handler=_prompt_instruct_error_impl,  # type: ignore[arg-type]
        error_event_name="prompt_instruct_error",
        error_response_type=PromptInstructToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/prompt_instruct_error",
    PromptInstructToolErrorSqlRow,
    "Error occurred in Member instruct tool",
)
