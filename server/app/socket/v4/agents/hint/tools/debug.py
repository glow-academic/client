"""Handler for debug tool completion - emits to client."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import (HintDebugCompleteApiRequest,
                           HintDebugErrorApiResponse)
from fastapi import APIRouter

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH_DEBUG_COMPLETE = "app/sql/v4/agents/hint_debug_complete_complete.sql"
SQL_PATH_DEBUG_ERROR = "app/sql/v4/agents/hint_debug_error_complete.sql"


async def _debug_tool_complete_impl(
    sid: str,
    data: HintDebugCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle debug tool completion - emits to client."""
    await emit_to_client(
        "debug_info_complete",
        {
            "success": True,
            "message": "Debug info tool completed",
        },
        room=sid,
    )


@internal_sio.on("hint_debug_complete")  # type: ignore
async def hint_debug_complete_internal(data: dict[str, Any]) -> None:
    """Handle hint_debug_complete event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintDebugCompleteApiRequest,
        handler=_debug_tool_complete_impl,  # type: ignore[arg-type]
        error_event_name="hint_error",
        error_response_type=HintDebugErrorApiResponse,
    )


register_server_endpoint(
    server_router,
    "/hint_debug_complete",
    HintDebugCompleteApiRequest,
    "Debug tool completed successfully",
)
