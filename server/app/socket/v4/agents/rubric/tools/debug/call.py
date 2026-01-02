"""Handler for debug_info WebSocket event."""

import uuid
from typing import Any, cast

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.sql_helper import execute_sql_typed

from app.infra.v4.websocket.find_profile_by_socket import find_profile_by_socket
from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.infra.v4.websocket.openapi_helpers import register_server_endpoint
from app.infra.v4.websocket.typed_emit import emit_to_client, emit_to_internal
from app.main import get_internal_sio
from pydantic import BaseModel


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

client_router = APIRouter()
server_router = APIRouter()

SQL_PATH = "app/sql/v4/tools/tools_debug_call_complete.sql"


class DebugInfoToolPayload(BaseModel):
    """Request to output debug information."""

    info: str
    profile_id: str | None = None
    sid: str | None = None


class DebugInfoToolCompletePayload(BaseModel):
    """Response indicating debug_info tool completed successfully."""

    success: bool
    message: str | None = None


class DebugInfoToolErrorPayload(BaseModel):
    """Response indicating an error occurred in debug_info tool."""

    success: bool
    message: str


async def debug_info_tool_complete(
    payload: DebugInfoToolCompletePayload, room: str
) -> None:
    await emit_to_client("debug_info_complete", payload, room=room)


async def debug_info_tool_error(payload: DebugInfoToolErrorPayload, room: str) -> None:
    await emit_to_client("debug_info_error", payload, room=room)


async def _debug_info_impl(sid: str, data: dict[str, Any]) -> str | None:
    """Internal implementation for debug_info tool."""
    try:
        validated = DebugInfoToolPayload(**data)
    except ValidationError as e:
        await debug_info_tool_error(
            DebugInfoToolErrorPayload(
                success=False,
                message=f"Invalid payload: {str(e)}",
            ),
            room=sid,
        )
        return None

    # Get profile_id from sid lookup
    profile_id_str = await find_profile_by_socket(sid)
    if not profile_id_str:
        await debug_info_tool_error(
            DebugInfoToolErrorPayload(
                success=False,
                message="Profile not found for socket",
            ),
            room=sid,
        )
        return None
    profile_id = uuid.UUID(profile_id_str)

    try:
        async with get_db_connection() as conn:
            # Execute debug_info tool call using execute_sql_typed()
            params = DebugInfoSqlParams(
                profile_id=profile_id,  # From sid lookup
                info=validated.info,
            )
            result = cast(
                DebugInfoSqlRow,
                await execute_sql_typed(conn, SQL_PATH, params=params),
            )

            # Emit complete event via internal bus
            await emit_to_internal(
                "debug_info_complete",
                DebugInfoToolCompletePayload(
                    success=result.success,
                    message=result.message,
                ),
                sid=sid,
            )

            return "success"

    except RuntimeError:
        await debug_info_tool_error(
            DebugInfoToolErrorPayload(
                success=False,
                message="Database connection pool not available",
            ),
            room=sid,
        )
        return None
    except Exception as e:
        await debug_info_tool_error(
            DebugInfoToolErrorPayload(
                success=False,
                message=f"Internal error: {str(e)}",
            ),
            room=sid,
        )
        return None


async def debug_info(sid: str, data: dict[str, Any]) -> None:
    """Handle debug_info event from client."""
    await _debug_info_impl(sid, data)


@internal_sio.on("debug_info")  # type: ignore
async def debug_info_internal(data: dict[str, Any]) -> None:
    """Handle debug_info event from internal bus (server-to-server)."""
    sid = data.get("sid", "")
    payload = {k: v for k, v in data.items() if k != "sid"}
    await _debug_info_impl(sid, payload)


register_server_endpoint(
    server_router,
    "/debug_info",
    DebugInfoToolPayload,
    "Debug info tool handler",
)
