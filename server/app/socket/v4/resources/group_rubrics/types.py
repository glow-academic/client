"""Unified event model for group_rubrics resource socket events."""

from app.api.v4.resources.group_rubrics.types import GroupRubricsResourceData


class GroupRubricsGenerationEvent(GroupRubricsResourceData):
    """Unified socket event for group_rubrics generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "group_rubrics"
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
