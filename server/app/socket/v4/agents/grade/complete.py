"""Handler for grade_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.main import get_internal_sio, sio

internal_sio = get_internal_sio()

server_router = APIRouter()


class GradeCompletePayload(BaseModel):
    """Generic grade complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    chat_id: str
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None


class GradeCompleteErrorPayload(BaseModel):
    """Error response for grade complete."""

    success: bool
    message: str


class GradeGenerateCompletePayload(BaseModel):
    """Payload for grade_generate_complete client event."""

    success: bool
    chat_id: str
    run_id: str


async def _grade_complete_impl(
    sid: str,
    data: GradeCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler
        # All grade tools use the same handler (grade tool)
        if data.tool_name and data.tool_name.startswith("grade_"):
            await internal_sio.emit(
                "grade_grade_complete",
                {
                    "sid": data.sid,
                    "chat_id": data.chat_id,
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
        chat_id_uuid = uuid.UUID(data.chat_id)
        room = f"simulation_{chat_id_uuid}"
        await sio.emit(
            "simulations_text_grading_complete",
            GradeGenerateCompletePayload(
                success=True,
                chat_id=data.chat_id,
                run_id=data.run_id,
            ).model_dump(),
            room=room,
        )


@internal_sio.on("grade_complete")  # type: ignore
async def grade_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle grade_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=GradeCompletePayload,
        handler=_grade_complete_impl,  # type: ignore[arg-type]
        error_event_name="grade_complete_error",
        error_response_type=GradeCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/grade_complete",
    GradeCompletePayload,
    "Dispatch grade complete to tool-specific handlers",
)
