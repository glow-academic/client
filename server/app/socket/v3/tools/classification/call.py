"""Handler for classification_tool WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from fastapi import APIRouter
from pydantic import BaseModel

internal_sio = get_internal_sio()
server_router = APIRouter()


class ClassificationToolCallApiRequest(BaseModel):
    """Request for classification tool call."""

    message: str | None = None


class ClassificationToolCompleteApiRequest(BaseModel):
    """Response indicating classification tool completed successfully."""

    success: bool
    message: str | None = None


class ClassificationToolErrorSqlRow(BaseModel):
    """Response indicating an error occurred in classification tool."""

    success: bool
    message: str


async def _classification_tool_call_impl(
    sid: str,
    data: ClassificationToolCallApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for classification tool call."""
    # No-op for now - SQL files not yet created
    # Emit to internal complete event (will be handled by complete.py)
    await emit_to_internal(
        "classification_complete",
        ClassificationToolCompleteApiRequest(
            success=True,
            message="Classification processed successfully",
        ),
        sid=sid,
        group_id=str(group_id) if group_id else None,
    )


@internal_sio.on("classification_tool")  # type: ignore
async def classification_tool_internal(
    data: dict[str, Any],
) -> None:
    """Handle classification_tool event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ClassificationToolCallApiRequest,
        handler=_classification_tool_call_impl,  # type: ignore[arg-type]
        error_event_name="classification_error",
        error_response_type=ClassificationToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/classification_tool",
    ClassificationToolCallApiRequest,
    "Classification tool handler",
)

