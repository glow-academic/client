"""Typed event models for simulation_positions resource socket events."""

from typing import Any

from pydantic import BaseModel


class SimulationPositionsGenerationStartedEvent(BaseModel):
    """Server-to-client event: simulation_positions_generation_started."""

    artifact_type: str
    resource_type: str = "simulation_positions"
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None


class SimulationPositionsGenerationProgressEvent(BaseModel):
    """Server-to-client event: simulation_positions_generation_progress."""

    artifact_type: str
    resource_type: str = "simulation_positions"
    group_id: str | None = None
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    arguments_delta: str | None = None
    arguments: dict[str, Any] | None = None


class SimulationPositionsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: simulation_positions_generation_complete."""

    artifact_type: str
    resource_type: str = "simulation_positions"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    id: str | None = None
    simulation_id: str | None = None
    value: int | None = None
    generated: bool | None = None
    mcp: bool | None = None


class SimulationPositionsGenerationErrorEvent(BaseModel):
    """Server-to-client event: simulation_positions_generation_error."""

    artifact_type: str
    resource_type: str = "simulation_positions"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
