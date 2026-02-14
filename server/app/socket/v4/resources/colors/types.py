"""Typed event models for colors resource socket events."""

from typing import Any

from pydantic import BaseModel


class ColorsGenerationStartedEvent(BaseModel):
    """Server-to-client event: colors_generation_started."""

    artifact_type: str
    resource_type: str = "colors"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class ColorsGenerationProgressEvent(BaseModel):
    """Server-to-client event: colors_generation_progress."""

    artifact_type: str
    resource_type: str = "colors"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class ColorsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: colors_generation_complete."""

    artifact_type: str
    resource_type: str = "colors"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    name: str | None = None
    description: str | None = None
    hex_code: str | None = None
    generated: bool | None = None


class ColorsGenerationErrorEvent(BaseModel):
    """Server-to-client event: colors_generation_error."""

    artifact_type: str
    resource_type: str = "colors"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
