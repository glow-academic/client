"""Typed event models for request_limits resource socket events."""

from typing import Any

from pydantic import BaseModel


class RequestLimitsGenerationStartedEvent(BaseModel):
    """Server-to-client event: request_limits_generation_started."""

    artifact_type: str
    resource_type: str = "request_limits"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class RequestLimitsGenerationProgressEvent(BaseModel):
    """Server-to-client event: request_limits_generation_progress."""

    artifact_type: str
    resource_type: str = "request_limits"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class RequestLimitsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: request_limits_generation_complete."""

    artifact_type: str
    resource_type: str = "request_limits"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    requests_per_day: int | None = None
    generated: bool | None = None


class RequestLimitsGenerationErrorEvent(BaseModel):
    """Server-to-client event: request_limits_generation_error."""

    artifact_type: str
    resource_type: str = "request_limits"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
