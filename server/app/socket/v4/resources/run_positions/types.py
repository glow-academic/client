"""Typed event models for run_positions resource socket events."""

from typing import Any

from pydantic import BaseModel


class RunPositionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: run_positions_generation_started."""

    artifact_type: str
    resource_type: str = "run_positions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class RunPositionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: run_positions_generation_progress."""

    artifact_type: str
    resource_type: str = "run_positions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class RunPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: run_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "run_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    runs_id: str | None = None
    eval_id: str | None = None
    value: int | None = None
    generated: bool | None = None


class RunPositionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: run_positions_generation_error."""

    artifact_type: str
    resource_type: str = "run_positions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
