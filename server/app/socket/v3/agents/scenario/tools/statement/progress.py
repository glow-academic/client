"""Handler for scenario_tool_statement_description_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


class TitleDescriptionProgressPayload(BaseModel):
    """Response indicating progress in title description tool."""

    type: str
    trace_id: str
    message: str | None = None


class TitleDescriptionErrorPayload(BaseModel):
    """Response indicating an error occurred in title description tool."""

    success: bool
    message: str
    trace_id: str


async def _title_description_progress_impl(
    sid: str,
    data: TitleDescriptionProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_statement_progress",
        data,
        room=sid,
    )


@internal_sio.on("title_description_progress")  # type: ignore
async def title_description_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle title_description_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=TitleDescriptionProgressPayload,
        handler=_title_description_progress_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_statement_error",
        error_response_type=TitleDescriptionErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/title_description_progress",
    TitleDescriptionProgressPayload,
    "Progress update for title description tool",
)
