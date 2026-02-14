"""Typed event models for temperature_levels resource socket events."""

from typing import Any

from pydantic import BaseModel


class TemperatureLevelsGenerationStartedEvent(BaseModel):
    """Server-to-client event: temperature_levels_generation_started."""

    artifact_type: str
    resource_type: str = "temperature_levels"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class TemperatureLevelsGenerationProgressEvent(BaseModel):
    """Server-to-client event: temperature_levels_generation_progress."""

    artifact_type: str
    resource_type: str = "temperature_levels"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class TemperatureLevelsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: temperature_levels_generation_complete."""

    artifact_type: str
    resource_type: str = "temperature_levels"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    temperature: float | None = None
    generated: bool | None = None


class TemperatureLevelsGenerationErrorEvent(BaseModel):
    """Server-to-client event: temperature_levels_generation_error."""

    artifact_type: str
    resource_type: str = "temperature_levels"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
