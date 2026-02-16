"""Unified event model for parameter_fields resource socket events."""

from app.api.v4.resources.parameter_fields.types import ParameterFieldsResourceData


class ParameterFieldsGenerationEvent(ParameterFieldsResourceData):
    """Unified socket event for parameter_fields generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "parameter_fields"
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
