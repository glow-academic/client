"""WebSocket-specific types for record generation.

Extends base artifact types with record-specific fields.
Types are registered in OpenAPI via FastAPI endpoints, enabling
automatic type extraction in the frontend via InputOf/OutputOf.
"""

from pydantic import BaseModel

from app.api.v4.artifacts.record.types import GetRecordApiRequest
from app.socket.v4.artifacts.types import (
    GenerationCompleteEvent,
    GenerationErrorEvent,
)

# =============================================================================
# Generation type constants
# =============================================================================

RECORD_RESOURCE_TYPES: list[str] = []

RECORD_SYNC_ENTRY_TYPES = ["runs"]

RECORD_ASYNC_ENTRY_TYPES = ["insights", "debug_info"]

# =============================================================================
# Client-to-Server Events (record_generate)
# =============================================================================


class GenerateRecordPayload(GetRecordApiRequest):
    """Request payload for record_generate WebSocket event."""

    resource_types: list[str]
    user_instructions: list[str] | None = None
    save: bool = True


# =============================================================================
# Server-to-Client Events
# =============================================================================


class RecordGenerationCompleteEvent(GenerationCompleteEvent):
    """Server-to-client event: record_generation_complete."""

    artifact_type: str = "record"
    record_id: str | None = None


class RecordGenerationProgressEvent(BaseModel):
    """Server-to-client event: record_generation_progress."""

    artifact_type: str = "record"
    group_id: str
    run_id: str | None = None
    completed_resources: int
    total_resources: int
    percentage: int
    last_completed_resource: str | None = None


class RecordGenerationErrorEvent(GenerationErrorEvent):
    """Server-to-client event: record_generation_error."""

    artifact_type: str = "record"
