"""Typed event models for simulations resource socket events."""

from typing import Any

from pydantic import BaseModel


class SimulationsGenerationStartedEvent(BaseModel):
    """Server-to-client event: simulations_generation_started."""

    artifact_type: str
    resource_type: str = "simulations"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class SimulationsGenerationProgressEvent(BaseModel):
    """Server-to-client event: simulations_generation_progress."""

    artifact_type: str
    resource_type: str = "simulations"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class SimulationsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: simulations_generation_complete."""

    artifact_type: str
    resource_type: str = "simulations"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    simulation_id: str | None = None
    name: str | None = None
    description: str | None = None
    department_ids: list[str] | None = None
    active: bool | None = None
    generated: bool | None = None


class SimulationsGenerationErrorEvent(BaseModel):
    """Server-to-client event: simulations_generation_error."""

    artifact_type: str
    resource_type: str = "simulations"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
