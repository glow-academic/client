"""Handler for hint_tool_debug WebSocket event - ONE EVENT PER FILE."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.handler_wrapper import handle_internal_event
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_internal
from app.main import get_internal_sio
from pydantic import BaseModel
from utils.sql_helper import execute_sql_typed

# Types for debug_info function - defined locally since SQL path doesn't match type generation pattern
class DebugInfoSqlParams(BaseModel):
    """Parameters for socket_debug_info_v4 function."""
    profile_id: uuid.UUID
    info: str

    def to_tuple(self) -> tuple[Any, ...]:
        return (self.profile_id, self.info)

class DebugInfoSqlRow(BaseModel):
    """Response from socket_debug_info_v4 function."""
    success: bool
    message: str

internal_sio = get_internal_sio()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/tools/tools_debug_call_complete.sql"


class HintToolDebugApiRequest(BaseModel):
    """Request for hint debug tool call."""

    info: str


class HintToolDebugCompleteApiRequest(BaseModel):
    """Response indicating hint debug tool completed successfully."""

    success: bool
    message: str | None = None


class HintToolDebugErrorSqlRow(BaseModel):
    """Response indicating an error occurred in hint debug tool."""

    success: bool
    message: str


async def _hint_tool_debug_impl(
    sid: str,
    data: HintToolDebugApiRequest,
    profile_id: uuid.UUID,
    group_id: uuid.UUID | None = None,
) -> None:
    """Internal implementation for hint debug tool call."""
    try:
        async with get_db_connection() as conn:
            # Execute debug_info tool call using typed SQL execution
            params = DebugInfoSqlParams(
                profile_id=profile_id,  # From sid lookup
                info=data.info,
            )
            result = cast(
                DebugInfoSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit complete event via internal bus
            await emit_to_internal(
                "hint_tool_debug_complete",
                HintToolDebugCompleteApiRequest(
                    success=result.success,
                    message=result.message,
                ),
                sid=sid,
                group_id=str(group_id) if group_id else None,
            )
    except RuntimeError:
        # Pool not initialized - emit error event
        await emit_to_internal(
            "hint_tool_debug_error",
            HintToolDebugErrorSqlRow(
                success=False,
                message="Database connection pool not available",
            ),
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )
    except Exception as e:
        await emit_to_internal(
            "hint_tool_debug_error",
            HintToolDebugErrorSqlRow(
                success=False,
                message=f"Error in debug tool: {str(e)}",
            ),
            sid=sid,
            group_id=str(group_id) if group_id else None,
        )


@internal_sio.on("hint_tool_debug")  # type: ignore
async def hint_tool_debug_internal(
    data: dict[str, Any],
) -> None:
    """Handle hint_tool_debug event from internal bus (server-to-server)."""
    await handle_internal_event(
        data=data,
        request_type=HintToolDebugApiRequest,
        handler=_hint_tool_debug_impl,  # type: ignore[arg-type]
        error_event_name="hint_tool_debug_error",
        error_response_type=HintToolDebugErrorSqlRow,
    )


register_server_endpoint(
    server_router,
    "/hint_tool_debug",
    HintToolDebugApiRequest,
    "Hint debug tool handler",
)
