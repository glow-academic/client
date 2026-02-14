"""Typed event models for simulations resource generation."""

from typing import Any

from pydantic import BaseModel


class SimulationsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: simulations_generation_complete."""

    artifact_type: str
    resource_type: str = "simulations"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
