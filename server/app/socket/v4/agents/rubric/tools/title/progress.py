"""Handler for rubric_tool_title_progress WebSocket event - ONE EVENT PER FILE."""

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


class RubricTitleProgressPayload(BaseModel):
    """Response indicating progress in Rubric Title tool."""

    type: str
    message: str | None = None


class RubricTitleErrorPayload(BaseModel):
    """Response indicating an error occurred in Rubric Title tool."""

    success: bool
    message: str
    trace_id: str


async def _rubric_tool_title_progress_impl(
    sid: str,
    data: RubricTitleProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "rubric_tool_title_progress",
        data,
        room=sid,
    )


@internal_sio.on("rubric_tool_title_progress")  # type: ignore
async def title_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle rubric_tool_title_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=RubricTitleProgressPayload,
        handler=_rubric_tool_title_progress_impl,  # type: ignore[arg-type]
        error_event_name="rubric_tool_title_error",
        error_response_type=RubricTitleErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/rubric_tool_title_progress",
    RubricTitleProgressPayload,
    "Progress update for Rubric Title tool",
)
