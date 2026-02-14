"""Typed event models for evals resource socket events."""

from typing import Any

from pydantic import BaseModel


class EvalsGenerationStartedEvent(BaseModel):
    """Server-to-client event: evals_generation_started."""

    artifact_type: str
    resource_type: str = "evals"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class EvalsGenerationProgressEvent(BaseModel):
    """Server-to-client event: evals_generation_progress."""

    artifact_type: str
    resource_type: str = "evals"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class EvalsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: evals_generation_complete."""

    artifact_type: str
    resource_type: str = "evals"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    generated: bool | None = None


class EvalsGenerationErrorEvent(BaseModel):
    """Server-to-client event: evals_generation_error."""

    artifact_type: str
    resource_type: str = "evals"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
