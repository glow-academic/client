"""Handler for standard_description_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter
from app.sql.types import StandardGroupDescriptionsErrorSqlRow

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _standard_description_error_impl(
    sid: str,
    data: StandardGroupDescriptionsErrorSqlRow,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    # Emit to client with same event name as standard_group_descriptions for compatibility
    await emit_to_client(
        "rubrics_tools_standard_description_error",
        data,
        room=sid,
    )


@internal_sio.on("standard_description_error")  # type: ignore
async def standard_description_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle standard_description_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=StandardGroupDescriptionsErrorSqlRow,
        handler=_standard_description_error_impl,  # type: ignore[arg-type]
        error_event_name="standard_description_error",
        error_response_type=StandardGroupDescriptionsErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/standard_description_error",
    StandardGroupDescriptionsErrorSqlRow,
    "Error occurred in StandardDescription tool (replaces standard_group_descriptions)",
)

