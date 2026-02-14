"""Typed event models for scenario_personas resource generation."""

from typing import Any

from pydantic import BaseModel


class ScenarioPersonasGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_personas_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_personas"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
