"""Typed event models for simulation_messages entry socket events."""

from typing import Any

from pydantic import BaseModel


class SimulationMessagesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: simulation_messages_generation_complete."""

    artifact_type: str
    entry_type: str = "simulation_messages"
    entry_id: str | None = None
    group_id: str
    run_id: str | None = None
    tool_call_id: str | None = None
    tool_name: str | None = None
    success: bool = True


class SimulationMessagesGenerationErrorEvent(BaseModel):
    """Server-to-client event: simulation_messages_generation_error."""

    artifact_type: str
    entry_type: str = "simulation_messages"
    group_id: str | None = None
    run_id: str | None = None
    success: bool = False
    message: str = ""
    error_stage: str | None = None
    tool_name: str | None = None
    tool_call_id: str | None = None
    arguments: dict[str, Any] | None = None
