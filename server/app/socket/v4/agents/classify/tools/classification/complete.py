"""Handler for classification_complete WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any

from fastapi import APIRouter

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio

from .call import (
    ClassificationToolCompleteApiRequest,
    ClassificationToolErrorSqlRow,
)

internal_sio = get_internal_sio()
server_router = APIRouter()


async def _classification_complete_impl(
    sid: str,
    data: ClassificationToolCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation - emits to client."""
    await emit_to_client(
        "classification_complete",
        data,
        room=sid,
    )


@internal_sio.on("classification_complete")  # type: ignore
async def classification_complete_internal(
    data: dict[str, Any],
) -> None:
    """Handle classification_complete event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=ClassificationToolCompleteApiRequest,
        handler=_classification_complete_impl,  # type: ignore[arg-type]
        error_event_name="classification_error",
        error_response_type=ClassificationToolErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/classification_complete",
    ClassificationToolCompleteApiRequest,
    "Classification tool completed successfully",
)
