"""Typed event models for temperature_levels resource generation."""

from typing import Any

from pydantic import BaseModel


class TemperatureLevelsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: temperature_levels_generation_complete."""

    artifact_type: str
    resource_type: str = "temperature_levels"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
