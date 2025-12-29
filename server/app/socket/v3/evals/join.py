"""Handler for eval_join WebSocket event."""

from typing import Any

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import sio
from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalJoinedPayload(BaseModel):
    """Response indicating successfully joined eval room."""

    attempt_id: str


class EvalJoinErrorPayload(BaseModel):
    """Response indicating an error occurred while joining eval room."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class EvalJoinPayload(BaseModel):
    """Request to join an eval room for real-time updates."""

    attempt_id: str


# Emit helper functions
async def eval_joined(payload: EvalJoinedPayload, room: str) -> None:
    await sio.emit("evals_joined", payload.model_dump(), room=room)


async def eval_join_error(payload: EvalJoinErrorPayload, room: str) -> None:
    await sio.emit("evals_join_error", payload.model_dump(), room=room)


async def _eval_join_impl(sid: str, data: EvalJoinPayload) -> None:
    """Join a specific eval room for real-time updates"""
    attempt_id = data.attempt_id

    if attempt_id:
        room_name = f"eval_{attempt_id}"
        await sio.enter_room(sid, room_name)
        logger.info(
            f"Client {sid} joined eval attempt {attempt_id} (room: {room_name})"
        )
        await eval_joined(EvalJoinedPayload(attempt_id=attempt_id), room=sid)
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="evals.joined",
                template="{{ actor.name }} joined eval",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v3/evals/join",
                error=False,
            )
        except Exception as log_error:
            logger.warning(f"Error logging eval join activity: {log_error}")
    else:
        await eval_join_error(
            EvalJoinErrorPayload(
                success=False, message="Missing attempt_id for eval join"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def eval_join(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalJoinPayload(**data)
        await _eval_join_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_join for {sid}: {e}")
        await eval_join_error(
            EvalJoinErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/join", response_model=dict[str, bool])
async def eval_join_api(request: EvalJoinPayload) -> dict[str, bool]:
    """Client-to-server event: Join an eval room for real-time updates."""
    return {"success": True}


@server_router.post("/joined", response_model=dict[str, bool])
async def eval_joined_api(request: EvalJoinedPayload) -> dict[str, bool]:
    """Server-to-client event: Successfully joined eval room."""
    return {"success": True}


@server_router.post("/join_error", response_model=dict[str, bool])
async def eval_join_error_api(request: EvalJoinErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Error occurred while joining eval room."""
    return {"success": True}

