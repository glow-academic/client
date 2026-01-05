"""Handler for hint_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class HintCompletePayload(BaseModel):
    """Generic hint complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    chat_id: str | None = None
    message_id: str | None = None
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None


class HintCompleteErrorPayload(BaseModel):
    """Error response for hint complete."""

    success: bool
    message: str


class HintGenerateCompletePayload(BaseModel):
    """Payload for hint_generate_complete client event."""

    success: bool
    message: str | None = None


async def _hint_complete_impl(
    sid: str,
    data: HintCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler
        if data.tool_name == "create_hint":
            await internal_sio.emit(
                "hint_hint_complete",
                {
                    "sid": data.sid,
                    "chat_id": data.chat_id or "",
                    "message_id": data.message_id or "",
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "final_content": data.final_content or "",
                    "arguments_raw": data.arguments_raw or "",
                },
            )

    elif data.type == "run_complete":
        # All tools done - emit overall completion
        await sio.emit(
            "simulation_hints_complete",
            HintGenerateCompletePayload(
                success=True,
                message="Hint generation completed successfully",
            ).model_dump(),
            room=sid,
        )


@internal_sio.on("hint_complete")  # type: ignore
async def hint_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintCompletePayload,
        handler=_hint_complete_impl,  # type: ignore[arg-type]
        error_event_name="hint_complete_error",
        error_response_type=HintCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_complete",
    HintCompletePayload,
    "Dispatch hint complete to tool-specific handlers",
)
