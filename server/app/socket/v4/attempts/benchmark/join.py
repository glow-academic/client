"""Handler for benchmark_join WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from app.utils.logging.db_logger import get_logger

from app.infra.v4.activity.websocket_logger import log_websocket_activity
from app.main import sio

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class BenchmarkJoinedPayload(BaseModel):
    """Response indicating successfully joined benchmark room."""

    attempt_id: str


class BenchmarkJoinErrorPayload(BaseModel):
    """Response indicating an error occurred while joining benchmark room."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class BenchmarkJoinPayload(BaseModel):
    """Request to join a benchmark room for real-time updates."""

    attempt_id: str


# Emit helper functions
async def benchmark_joined(payload: BenchmarkJoinedPayload, room: str) -> None:
    await sio.emit("benchmarks_joined", payload.model_dump(), room=room)


async def benchmark_join_error(payload: BenchmarkJoinErrorPayload, room: str) -> None:
    await sio.emit("benchmarks_join_error", payload.model_dump(), room=room)


async def _benchmark_join_impl(sid: str, data: BenchmarkJoinPayload) -> None:
    """Join a specific benchmark room for real-time updates"""
    attempt_id = data.attempt_id

    if attempt_id:
        room_name = f"benchmark_{attempt_id}"
        await sio.enter_room(sid, room_name)
        await benchmark_joined(BenchmarkJoinedPayload(attempt_id=attempt_id), room=sid)
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="benchmarks.joined",
                template="{{ actor.name }} joined benchmark",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v4/benchmark/join",
                error=False,
            )
        except Exception:
            pass
    else:
        await benchmark_join_error(
            BenchmarkJoinErrorPayload(
                success=False, message="Missing attempt_id for benchmark join"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def benchmark_join(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = BenchmarkJoinPayload(**data)
        await _benchmark_join_impl(sid, validated)
    except ValidationError as e:
        await benchmark_join_error(
            BenchmarkJoinErrorPayload(
                success=False, message=f"Invalid payload: {str(e)}"
            ),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/join", response_model=dict[str, bool])
async def benchmark_join_api(request: BenchmarkJoinPayload) -> dict[str, bool]:
    """Client-to-server event: Join a benchmark room for real-time updates."""
    return {"success": True}


@server_router.post("/joined", response_model=dict[str, bool])
async def benchmark_joined_api(request: BenchmarkJoinedPayload) -> dict[str, bool]:
    """Server-to-client event: Successfully joined benchmark room."""
    return {"success": True}


@server_router.post("/join_error", response_model=dict[str, bool])
async def benchmark_join_error_api(
    request: BenchmarkJoinErrorPayload,
) -> dict[str, bool]:
    """Server-to-client event: Error occurred while joining benchmark room."""
    return {"success": True}
