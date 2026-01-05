"""Handler for hint_end WebSocket event - emits final client event for hint generation completion."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import (HintEndApiRequest, HintEndApiResponse,
                           HintEndSqlParams, HintEndSqlRow)
from fastapi import APIRouter
from utils.cache.invalidate_tags import invalidate_tags
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/agents/hint_end_complete.sql"


async def _hint_end_impl(
    sid: str,
    data: HintEndApiRequest,
    profile_id: uuid.UUID,
) -> None:
    """Handle hint completion - calls SQL function, invalidates cache, and emits final completion event."""
    if data.type != "run_complete":
        return  # tool_call_complete handled by tool-specific handlers

    if not data.run_id or not data.resource_id:
        missing_fields_error: HintEndApiResponse = HintEndApiResponse(
            success=False,
            message="Missing run_id or resource_id in run_complete event",
            chat_id=None,
        )
        await emit_to_client(
            "simulation_hints_error",
            missing_fields_error,
            room=sid,
        )
        return

    try:
        async with get_db_connection() as conn:
            # Call SQL function using double-star pattern (even if no-op, for consistency)
            params = HintEndSqlParams(**data.model_dump())
            result = cast(
                HintEndSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Invalidate cache
            await invalidate_tags(["hint_generation"])

            # Emit final completion to client
            # Hints were already created by tools/hint.py as each tool call completed
            response_payload: HintEndApiResponse = HintEndApiResponse(
                success=result.success if result else True,
                message=result.message if result else "Hint generation completed",
                chat_id=result.chat_id if result else data.resource_id,
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
