"""Unified event model for run_rubrics resource socket events."""

from app.api.v4.resources.run_rubrics.types import RunRubricsResourceData


class RunRubricsGenerationEvent(RunRubricsResourceData):
    """Unified socket event for run_rubrics generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "run_rubrics"
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
