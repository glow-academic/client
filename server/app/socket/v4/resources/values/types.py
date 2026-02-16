"""Unified event model for values resource socket events."""

from app.api.v4.resources.values.types import ValuesResourceData


class ValuesGenerationEvent(ValuesResourceData):
    """Unified socket event for values generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "values"
    resource_id: str | None = None
    group_id: str | None = None
    run_id: str | None = None
    # Completion
    success: bool | None = None
    # Error
    message: str | None = None
    error_stage: str | None = None
    # Tool call tracking
    tool_call_id: str | None = None
    tool_name: str | None = None
    # Streaming
    arguments_delta: str | None = None
