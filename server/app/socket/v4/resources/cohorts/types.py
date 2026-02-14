"""Typed event models for cohorts resource socket events."""

from typing import Any

from pydantic import BaseModel


class CohortsGenerationStartedEvent(BaseModel):
    """Server-to-client event: cohorts_generation_started."""

    artifact_type: str
    resource_type: str = "cohorts"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class CohortsGenerationProgressEvent(BaseModel):
    """Server-to-client event: cohorts_generation_progress."""

    artifact_type: str
    resource_type: str = "cohorts"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class CohortsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: cohorts_generation_complete."""

    artifact_type: str
    resource_type: str = "cohorts"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    cohort_id: str | None = None
    title: str | None = None
    description: str | None = None
    active: bool | None = None
    department_ids: list[str] | None = None


class CohortsGenerationErrorEvent(BaseModel):
    """Server-to-client event: cohorts_generation_error."""

    artifact_type: str
    resource_type: str = "cohorts"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
