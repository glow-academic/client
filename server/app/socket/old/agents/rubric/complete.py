"""Handler for rubric_complete WebSocket event - dispatches to tool-specific handlers and tracks overall completion."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from app.sql.types import RubricGenerationCompleteSqlRow

internal_sio = get_internal_sio()

server_router = APIRouter()


class RubricCompletePayload(BaseModel):
    """Generic rubric complete event - dispatches to tool-specific handlers."""

    sid: str
    type: str  # "tool_call_complete" | "run_complete"
    rubric_id: str | None = None
    run_id: str
    tool_name: str | None = None
    tool_call_id: str | None = None
    call_id: str | None = None
    final_content: str | None = None
    arguments_raw: str | None = None
    message: str | None = None


class RubricCompleteErrorPayload(BaseModel):
    """Error response for rubric complete."""

    success: bool
    message: str


async def _rubric_complete_impl(
    sid: str,
    data: RubricCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Dispatch to tool-specific complete handler."""
    if data.type == "tool_call_complete":
        # Route to appropriate tool handler
        if data.tool_name == "create_standard_description":
            await internal_sio.emit(
                "rubric_standard_description_complete",
                {
                    "sid": data.sid,
                    "rubric_id": data.rubric_id,
                    "run_id": data.run_id,
                    "tool_call_id": data.tool_call_id or "",
                    "call_id": data.call_id,
                    "tool_name": data.tool_name,
                    "final_content": data.final_content or "",
                    "arguments_raw": data.arguments_raw or "",
                },
            )
        # create_title tool was dropped
        elif False:  # create_title tool was dropped
            await internal_sio.emit(
                "rubric_title_complete",
                {
                    "sid": data.sid,
                    "rubric_id": data.rubric_id,
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
        await emit_to_client(
            "rubrics_generation_complete",
            RubricGenerationCompleteSqlRow(
                success=True,
                rubric_id=data.rubric_id,
                message=data.message or "Rubric generation completed successfully",
            ),
            room=sid,
        )


@internal_sio.on("rubric_complete")  # type: ignore
async def rubric_complete_internal(data: dict[str, Any]) -> None:
    """Handle rubric_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=RubricCompletePayload,
        handler=_rubric_complete_impl,  # type: ignore[arg-type]
        error_event_name="rubric_complete_error",
        error_response_type=RubricCompleteErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/rubric_complete",
    RubricCompletePayload,
    "Dispatch rubric complete to tool-specific handlers",
)
