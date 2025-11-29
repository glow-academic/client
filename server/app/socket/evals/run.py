"""Handler for eval run WebSocket events."""

from typing import Any

from pydantic import BaseModel, ValidationError

from app.main import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class EvalProgressPayload(BaseModel):
    eval_id: str
    model_run_id: str | None = None
    status: str  # 'running', 'completed', 'error'
    message: str
    grade_id: str | None = None


class EvalStartedPayload(BaseModel):
    eval_id: str
    message: str
    queued_count: int


class EvalCompletedPayload(BaseModel):
    eval_id: str
    message: str


class EvalErrorPayload(BaseModel):
    eval_id: str
    message: str


# Emit helper functions
async def eval_progress(payload: dict[str, Any], room: str) -> None:
    """Emit eval progress event."""
    await sio.emit("eval_progress", payload, room=room)


async def eval_started(payload: EvalStartedPayload, room: str) -> None:
    """Emit eval started event."""
    await sio.emit("eval_started", payload.model_dump(), room=room)


async def eval_completed(payload: EvalCompletedPayload, room: str) -> None:
    """Emit eval completed event."""
    await sio.emit("eval_completed", payload.model_dump(), room=room)


async def eval_error(payload: EvalErrorPayload, room: str) -> None:
    """Emit eval error event."""
    await sio.emit("eval_error", payload.model_dump(), room=room)

