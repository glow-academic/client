"""Typed event models for rubrics resource socket events."""

from typing import Any

from pydantic import BaseModel


class RubricsGenerationStartedEvent(BaseModel):
    """Server-to-client event: rubrics_generation_started."""

    artifact_type: str
    resource_type: str = "rubrics"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class RubricsGenerationProgressEvent(BaseModel):
    """Server-to-client event: rubrics_generation_progress."""

    artifact_type: str
    resource_type: str = "rubrics"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class RubricsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: rubrics_generation_complete."""

    artifact_type: str
    resource_type: str = "rubrics"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    standard_group_ids: list[str] | None = None


class RubricsGenerationErrorEvent(BaseModel):
    """Server-to-client event: rubrics_generation_error."""

    artifact_type: str
    resource_type: str = "rubrics"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
