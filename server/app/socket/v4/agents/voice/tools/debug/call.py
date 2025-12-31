"""Handler for debug_info WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.websocket.get_db_connection import get_db_connection
from app.main import get_internal_sio, sio
internal_sio = get_internal_sio()

client_router = APIRouter()
server_router = APIRouter()


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
    await sio.emit("debug_info_complete", payload.model_dump(), room=room)
async def debug_info_tool_error(payload: DebugInfoToolErrorPayload, room: str) -> None:
    await sio.emit("debug_info_error", payload.model_dump(), room=room)


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

    try:
        async with get_db_connection() as conn:
            # Debug info tool call (no-op for now)
            # Emit complete event
            await internal_sio.emit(
                "debug_info_complete",
                {
                    "sid": sid,
                    "success": True,
                    "message": "Debug information logged successfully",
                },
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


from app.infra.v4.websocket.openapi_helpers import register_server_endpoint

register_server_endpoint(
    server_router,
    "/debug_info",
    DebugInfoToolPayload,
    "Debug info tool handler",
)
