"""Handler for benchmark_leave WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.main import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkLeaveErrorPayload(BaseModel):
    """Response indicating an error occurred while leaving benchmark room."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class BenchmarkLeavePayload(BaseModel):
    """Request to leave a benchmark room."""

    attempt_id: str


# Emit helper functions
async def benchmark_leave_error(payload: BenchmarkLeaveErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_leave_error", payload.model_dump(), room=room)


async def _benchmark_leave_impl(sid: str, data: BenchmarkLeavePayload) -> None:
    """Leave a specific benchmark room"""
    attempt_id = data.attempt_id

    if attempt_id:
        room_name = f"benchmark_{attempt_id}"
        await sio.leave_room(sid, room_name)
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="benchmarks.left",
                template="{{ actor.name }} left benchmark",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v4/benchmark/leave",
                error=False,
            )
        except Exception:
            pass
    else:
        await benchmark_leave_error(
            BenchmarkLeaveErrorPayload(
                success=False, message="Missing attempt_id for benchmark leave"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_leave(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkLeavePayload(**data)
        await _benchmark_leave_impl(sid, validated)
    except ValidationError as e:
        await benchmark_leave_error(
            BenchmarkLeaveErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/leave", response_model=dict[str, bool])
async def benchmark_leave_api(request: BenchmarkLeavePayload) -> dict[str, bool]:
    """Client-to-server event: Leave a benchmark room."""
    return {"success": True}


@server_router.post("/leave_error", response_model=dict[str, bool])
async def benchmark_leave_error_api(
    request: BenchmarkLeaveErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while leaving benchmark room."""
    return {"success": True}
