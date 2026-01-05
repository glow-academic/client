"""Handler for hint_hint_progress - handles incremental updates for create_hint tool calls."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

server_router = APIRouter()


class HintHintProgressPayload(BaseModel):
    """Hint hint tool progress event."""

    sid: str
    type: str  # "tool_call_start" | "tool_call_progress"
    chat_id: str
    message_id: str
    run_id: str
    tool_call_id: str
    call_id: str | None = None
    tool_name: str
    arguments_raw: str


class HintHintProgressErrorPayload(BaseModel):
    """Error response for hint hint progress."""

    success: bool
    message: str


# Client-facing payload models
class HintProgressPayload(BaseModel):
    """Progress update for hint generation."""

    type: str
    chat_id: str | None = None
    message_id: str | None = None
    tool_name: str | None = None
    arguments_raw: str | None = None


async def _hint_hint_progress_impl(
    sid: str,
    data: HintHintProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle hint_hint_progress - tracks progress and emits to client."""
    try:
        if data.type == "tool_call_start":
            # Tool call started - no-op for now, will be handled on first progress
            pass

        elif data.type == "tool_call_progress":
            # Emit progress to client
            await sio.emit(
                "simulation_hints_progress",
                HintProgressPayload(
                    type="tool_call_progress",
                    chat_id=data.chat_id,
                    message_id=data.message_id,
                    tool_name=data.tool_name,
                    arguments_raw=data.arguments_raw,
                ).model_dump(),
                room=sid,
            )

    except Exception as e:
        await internal_sio.emit(
            "hint_hint_error",
            {
                "sid": sid,
                "success": False,
                "message": str(e),
            },
        )


@internal_sio.on("hint_hint_progress")  # type: ignore
async def hint_hint_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_hint_progress event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintHintProgressPayload,
        handler=_hint_hint_progress_impl,  # type: ignore[arg-type]
        error_event_name="hint_hint_error",
        error_response_type=HintHintProgressErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/hint_hint_progress",
    HintHintProgressPayload,
    "Progress update for Hint hint tool",
)
