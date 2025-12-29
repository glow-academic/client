"""Handler for grade_text_progress WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class GradeTextProgressPayload(BaseModel):
    """Response indicating progress in Grade Text generation."""

    type: str
    message: str | None = None


class GradeTextErrorPayload(BaseModel):
    """Response indicating an error occurred in Grade Text generation."""

    success: bool
    message: str


async def _grade_text_progress_impl(
    sid: str,
    data: GradeTextProgressPayload,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "simulations_text_grading_progress",
        data,
        room=sid,
    )


@internal_sio.on("grade_text_progress")  # type: ignore
async def grade_text_progress_internal(
    data: dict[str, Any],
) -> None:
    """Handle grade_text_progress event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=GradeTextProgressPayload,
        handler=_grade_text_progress_impl,  # type: ignore[arg-type]
        error_event_name="simulations_text_grading_error",
        error_response_type=GradeTextErrorPayload,
    )


register_server_endpoint(
    server_router,
    "/grade_text_progress",
    GradeTextProgressPayload,
    "Progress update for Grade Text generation",
)
