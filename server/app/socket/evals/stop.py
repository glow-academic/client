"""Handler for eval stop WebSocket events."""


from pydantic import BaseModel

from app.main import sio
from app.utils.logging.db_logger import get_logger

logger = get_logger(__name__)


# Pydantic models for server-to-client events
class EvalStoppedPayload(BaseModel):
    eval_id: str
    success: bool
    message: str
    stopped_count: int


class StopEvalErrorPayload(BaseModel):
    success: bool
    message: str


# Emit helper functions
async def eval_stopped(payload: EvalStoppedPayload, room: str) -> None:
    """Emit eval stopped event."""
    await sio.emit("eval_stopped", payload.model_dump(), room=room)


async def stop_eval_error(payload: StopEvalErrorPayload, room: str) -> None:
    """Emit eval stop error event."""
    await sio.emit("stop_eval_error", payload.model_dump(), room=room)
