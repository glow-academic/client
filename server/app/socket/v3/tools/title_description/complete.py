"""Handler for title_description_complete WebSocket event - ONE EVENT PER FILE."""

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


class TitleDescriptionCompletePayload(BaseModel):
    """Response indicating title description tool completed successfully."""

    success: bool
    problem_statement_id: str
    trace_id: str
    message: str | None = None


async def _title_description_complete_impl(
    sid: str,
    data: TitleDescriptionCompletePayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "scenarios_tools_statement_complete",
        data,
        room=sid,
    )


@internal_sio.on("title_description_complete")  # type: ignore
async def title_description_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle title_description_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=TitleDescriptionCompletePayload,
        handler=_title_description_complete_impl,  # type: ignore[arg-type]
        error_event_name="scenarios_tools_statement_error",
        error_response_type=None,
    )


register_server_endpoint(
    server_router,
    "/title_description_complete",
    TitleDescriptionCompletePayload,
    "Title description tool completed successfully",
)
