"""WebSocket-specific types for group generation."""

from pydantic import BaseModel

from app.api.v4.artifacts.group.types import GetGroupApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

GROUP_RESOURCE_TYPES: list[str] = []
GROUP_SYNC_ENTRY_TYPES = ["runs"]
GROUP_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]


class GenerateGroupPayload(GetGroupApiRequest):
    """Request payload for group_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


class GroupGenerationCompleteEvent(GenerationCompleteEvent):
    artifact_type: str = "group"
    group_id: str | None = None


class GroupGenerationProgressEvent(BaseModel):
    artifact_type: str = "group"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str | None = None


class GroupGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "group"
