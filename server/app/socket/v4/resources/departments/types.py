"""Typed event models for departments resource socket events."""

from typing import Any

from pydantic import BaseModel


class DepartmentsGenerationStartedEvent(BaseModel):
    """Server-to-client event: departments_generation_started."""

    artifact_type: str
    resource_type: str = "departments"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class DepartmentsGenerationProgressEvent(BaseModel):
    """Server-to-client event: departments_generation_progress."""

    artifact_type: str
    resource_type: str = "departments"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class DepartmentsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: departments_generation_complete."""

    artifact_type: str
    resource_type: str = "departments"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    department_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None


class DepartmentsGenerationErrorEvent(BaseModel):
    """Server-to-client event: departments_generation_error."""

    artifact_type: str
    resource_type: str = "departments"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
