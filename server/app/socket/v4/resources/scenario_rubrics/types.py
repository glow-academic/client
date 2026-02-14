"""Typed event models for scenario_rubrics resource generation."""

from typing import Any

from pydantic import BaseModel


class ScenarioRubricsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenario_rubrics_generation_complete."""

    artifact_type: str
    resource_type: str = "scenario_rubrics"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
