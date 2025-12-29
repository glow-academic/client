"""Handler for eval_leave WebSocket event."""

from typing import Any

from fastapi import APIRouter
from pydantic import BaseModel, ValidationError
from utils.logging.db_logger import get_logger

from app.infra.v3.activity.websocket_logger import log_websocket_activity
from app.main import sio

logger = get_logger(__name__)

client_router = APIRouter()
server_router = APIRouter()


# Pydantic models for server-to-client events
class EvalLeaveErrorPayload(BaseModel):
    """Response indicating an error occurred while leaving eval room."""

    success: bool
    message: str


# Pydantic model for client-to-server event
class EvalLeavePayload(BaseModel):
    """Request to leave an eval room."""

    attempt_id: str


# Emit helper functions
async def eval_leave_error(payload: EvalLeaveErrorPayload, room: str) -> None:
    await sio.emit("evals_leave_error", payload.model_dump(), room=room)


async def _eval_leave_impl(sid: str, data: EvalLeavePayload) -> None:
    """Leave a specific eval room"""
    attempt_id = data.attempt_id

    if attempt_id:
        room_name = f"eval_{attempt_id}"
        await sio.leave_room(sid, room_name)
        logger.info(f"Client {sid} left eval attempt {attempt_id}")
        # Log activity
        try:
            await log_websocket_activity(
                sid=sid,
                event_key="evals.left",
                template="{{ actor.name }} left eval",
                context={"attempt_id": attempt_id},
                endpoint="/socket/v3/evals/leave",
                error=False,
            )
        except Exception as log_error:
            logger.warning(f"Error logging eval leave activity: {log_error}")
    else:
        await eval_leave_error(
            EvalLeaveErrorPayload(
                success=False, message="Missing attempt_id for eval leave"
            ),
            room=sid,
        )


@sio.event  # type: ignore
async def eval_leave(sid: str, data: dict[str, Any]) -> None:
    """Wrapper that validates payload before calling actual handler"""
    try:
        validated = EvalLeavePayload(**data)
        await _eval_leave_impl(sid, validated)
    except ValidationError as e:
        logger.error(f"Validation error in eval_leave for {sid}: {e}")
        await eval_leave_error(
            EvalLeaveErrorPayload(success=False, message=f"Invalid payload: {str(e)}"),
            room=sid,
        )


# FastAPI endpoint for OpenAPI documentation
@client_router.post("/leave", response_model=dict[str, bool])
async def eval_leave_api(request: EvalLeavePayload) -> dict[str, bool]:
    """Client-to-server event: Leave an eval room."""
    return {"success": True}


@server_router.post("/leave_error", response_model=dict[str, bool])
async def eval_leave_error_api(request: EvalLeaveErrorPayload) -> dict[str, bool]:
    """Server-to-client event: Error occurred while leaving eval room."""
    return {"success": True}
