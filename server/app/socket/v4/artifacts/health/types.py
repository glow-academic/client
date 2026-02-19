"""WebSocket-specific types for health generation."""

from pydantic import BaseModel

from app.api.v4.artifacts.health.types import GetHealthApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

HEALTH_RESOURCE_TYPES: list[str] = []
HEALTH_SYNC_ENTRY_TYPES = ["runs"]
HEALTH_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]


class GenerateHealthPayload(GetHealthApiRequest):
    """Request payload for health_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


class HealthGenerationCompleteEvent(GenerationCompleteEvent):
    artifact_type: str = "health"
    health_id: str | None = None


class HealthGenerationProgressEvent(BaseModel):
    artifact_type: str = "health"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str | None = None


class HealthGenerationErrorEvent(GenerationErrorEvent):
    artifact_type: str = "health"
