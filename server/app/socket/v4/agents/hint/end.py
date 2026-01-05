"""Handler for hint_end WebSocket event - emits final client event for hint generation completion."""

import uuid
from typing import Any

from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import HintEndApiRequest, HintEndApiResponse
from fastapi import APIRouter
from utils.cache.invalidate_tags import invalidate_tags

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH_HINT_END = "app/sql/v4/agents/hint_end_complete.sql"


async def _hint_end_impl(
    sid: str,
    data: HintEndApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle hint completion - emits final completion event (hints already created by tool handlers)."""
    if data.type != "run_complete":
        return  # tool_call_complete handled by tool-specific handlers

    if not data.run_id or not data.resource_id:
        error_payload: HintEndApiResponse = HintEndApiResponse(
            success=False,
            message="Missing run_id or resource_id in run_complete event",
            chat_id=None,
        )
        await emit_to_client(
            "simulation_hints_error",
            error_payload,
            room=sid,
        )
        return

    try:
        # Invalidate cache
        await invalidate_tags(["hint_generation"])

        # Emit final completion to client
        # Hints were already created by tools/hint.py as each tool call completed
        response_payload: HintEndApiResponse = HintEndApiResponse(
            success=True,
            message="Hint generation completed",
            chat_id=data.resource_id,
        )
        await emit_to_client(
            "simulation_hints_complete",
            response_payload,
            room=sid,
        )

    except Exception as e:
        error_payload: HintEndApiResponse = HintEndApiResponse(
            success=False,
            message=f"Failed to finalize hint generation: {str(e)}",
            chat_id=None,
        )
        await emit_to_client(
            "simulation_hints_error",
            error_payload,
            room=sid,
        )


@internal_sio.on("hint_end")  # type: ignore
async def hint_end_internal(data: dict[str, Any]) -> None:
    """Handle hint_end event from internal bus."""
    await handle_internal_event(
        data=data,
        request_type=HintEndApiRequest,
        handler=_hint_end_impl,  # type: ignore[arg-type]
        error_event_name="hint_error",
        error_response_type=None,
    )


register_server_endpoint(  # type: ignore[arg-type]
    server_router,
    "/hint_end",
    HintEndApiRequest,
    "Handle hint generation completion - emits final client event",
)
