"""Typed event models for scenarios resource socket events."""

from typing import Any

from pydantic import BaseModel


class ScenariosGenerationStartedEvent(BaseModel):
    """Server-to-client event: scenarios_generation_started."""

    artifact_type: str
    resource_type: str = "scenarios"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ScenariosGenerationProgressEvent(BaseModel):
    """Server-to-client event: scenarios_generation_progress."""

    artifact_type: str
    resource_type: str = "scenarios"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ScenariosGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenarios_generation_complete."""

    artifact_type: str
    resource_type: str = "scenarios"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    scenario_id: str | None = None
    name: str | None = None
    description: str | None = None
    generated: bool | None = None
    problem_statement_enabled: bool | None = None
    objectives_enabled: bool | None = None
    video_enabled: bool | None = None
    images_enabled: bool | None = None
    questions_enabled: bool | None = None
    persona_ids: list[str] | None = None
    parameter_field_ids: list[str] | None = None
    parameter_ids: list[str] | None = None


class ScenariosGenerationErrorEvent(BaseModel):
    """Server-to-client event: scenarios_generation_error."""

    artifact_type: str
    resource_type: str = "scenarios"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
