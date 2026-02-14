"""Typed event models for values resource socket events."""

from typing import Any

from pydantic import BaseModel


class ValuesGenerationStartedEvent(BaseModel):
    """Server-to-client event: values_generation_started."""

    artifact_type: str
    resource_type: str = "values"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ValuesGenerationProgressEvent(BaseModel):
    """Server-to-client event: values_generation_progress."""

    artifact_type: str
    resource_type: str = "values"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ValuesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: values_generation_complete."""

    artifact_type: str
    resource_type: str = "values"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    value: str | None = None
    generated: bool | None = None


class ValuesGenerationErrorEvent(BaseModel):
    """Server-to-client event: values_generation_error."""

    artifact_type: str
    resource_type: str = "values"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
