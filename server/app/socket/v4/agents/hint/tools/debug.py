"""Handler for debug tool completion - emits to client."""

import uuid
from typing import Any, cast

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client
from app.main import get_internal_sio, sio
from app.sql.types import (HintDebugCompleteApiRequest,
                           HintDebugCompleteApiResponse,
                           HintDebugCompleteSqlParams, HintDebugCompleteSqlRow,
                           HintDebugErrorApiResponse)
from fastapi import APIRouter
from utils.sql_helper import execute_sql_typed

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/agents/hint_debug_complete_complete.sql"


async def _debug_tool_complete_impl(
    sid: str,
    data: HintDebugCompleteApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Handle debug tool completion - calls SQL function and emits to client."""
    try:
        async with get_db_connection() as conn:
            # Call SQL function using double-star pattern (even if no-op, for consistency)
            params = HintDebugCompleteSqlParams(**data.model_dump())
            result = cast(
                HintDebugCompleteSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit completion to client
            response_payload: HintDebugCompleteApiResponse = HintDebugCompleteApiResponse(
                success=True,
                message=result.message if result else "Debug info tool completed",
            )
            await emit_to_client(
                "debug_info_complete",
                response_payload,
                room=sid,
            )
    except Exception as e:
        # Emit error if SQL call fails
        error_payload: HintDebugErrorApiResponse = HintDebugErrorApiResponse(
            success=False,
            message=f"Failed to complete debug tool: {str(e)}",
        )
        await emit_to_client(
            "debug_info_error",
            error_payload,
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


register_server_endpoint(  # type: ignore[arg-type]
    server_router,
    "/hint_debug_complete",
    HintDebugCompleteApiRequest,
    "Debug tool completed successfully",
)
