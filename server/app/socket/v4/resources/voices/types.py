"""Typed event models for voices resource socket events."""

from typing import Any

from pydantic import BaseModel


class VoicesGenerationStartedEvent(BaseModel):
    """Server-to-client event: voices_generation_started."""

    artifact_type: str
    resource_type: str = "voices"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class VoicesGenerationProgressEvent(BaseModel):
    """Server-to-client event: voices_generation_progress."""

    artifact_type: str
    resource_type: str = "voices"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class VoicesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: voices_generation_complete."""

    artifact_type: str
    resource_type: str = "voices"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    voice: str | None = None
    generated: bool | None = None


class VoicesGenerationErrorEvent(BaseModel):
    """Server-to-client event: voices_generation_error."""

    artifact_type: str
    resource_type: str = "voices"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
