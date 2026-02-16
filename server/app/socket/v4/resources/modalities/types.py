"""Unified event model for modalities resource socket events."""

from app.api.v4.resources.modalities.types import ModalitiesResourceData


class ModalitiesGenerationEvent(ModalitiesResourceData):
    """Unified socket event for modalities generation. Same type for all 4 events."""

    # Metadata
    artifact_type: str = ""
    resource_type: str = "modalities"
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
