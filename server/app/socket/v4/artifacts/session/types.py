"""WebSocket-specific types for session generation."""

from pydantic import BaseModel

from app.api.v4.artifacts.session.types import GetSessionApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

SESSION_RESOURCE_TYPES: list[str] = []
SESSION_SYNC_ENTRY_TYPES = ["runs"]
SESSION_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]


class GenerateSessionPayload(GetSessionApiRequest):
    """Request payload for session_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


class SessionGenerationCompleteEvent(GenerationCompleteEvent):
    artifact_type: str = "session"
    session_id: str | None = None


class SessionGenerationProgressEvent(BaseModel):
    artifact_type: str = "session"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str | None = None


class SessionGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "session"
