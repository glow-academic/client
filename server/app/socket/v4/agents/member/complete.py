"""Handler for member_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


class MemberCompletePayload(BaseModel):
    """Generic member complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    chat_id: str
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None


class MemberCompleteErrorPayload(BaseModel):
    """Error response for member complete."""

    success: bool
    message: str


class MemberGenerateCompletePayload(BaseModel):
    """Payload for member_generate_complete client event."""

    success: bool
    chat_id: str
    run_id: str


async def _member_complete_impl(
    sid: str,
    data: MemberCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler (only speak for member agent)
        if data.tool_name == "speak":
            await internal_sio.emit(
                "member_speak_complete",
                {
                    "sid": data.sid,
                    "chat_id": data.chat_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id,
                    "call_id": data.call_id,
                    "final_content": data.final_content,
                    "arguments_raw": data.arguments_raw,
                },
            )

    elif data.type == "run_complete":
        # All tools done - emit overall completion
        await emit_to_client(
            "member_generate_complete",
            MemberGenerateCompletePayload(
                success=True,
                chat_id=data.chat_id,
                run_id=data.run_id,
            ),
            room=sid,
        )


@internal_sio.on("member_complete")  # type: ignore
async def member_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle member_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=MemberCompletePayload,
        handler=_member_complete_impl,  # type: ignore[arg-type]
        error_event_name="member_complete_error",
        error_response_type=MemberCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/member_complete",
    MemberCompletePayload,
    "Dispatch member complete to tool-specific handlers",
)
