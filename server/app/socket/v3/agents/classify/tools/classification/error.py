"""Handler for classification_error WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v3.websocket.handler_wrapper import handle_internal_event
from app.infra.v3.websocket.openapi_helpers import register_server_endpoint
from app.infra.v3.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import ClassificationToolErrorSqlRow

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _classification_error_impl(
    sid: str,
    data: ClassificationToolErrorSqlRow,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "classification_error",
        data,
        room=sid,
    )


@internal_sio.on("classification_error")  # type: ignore
async def classification_error_internal(
    data: dict[str, Any],
) -> None:
    """Handle classification_error event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ClassificationToolErrorSqlRow,
        handler=_classification_error_impl,  # type: ignore[arg-type]
        error_event_name="classification_error",
        error_response_type=ClassificationToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/classification_error",
    ClassificationToolErrorSqlRow,
    "Error occurred in Classification tool",
)
