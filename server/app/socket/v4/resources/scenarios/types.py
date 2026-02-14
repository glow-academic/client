"""Typed event models for scenarios resource generation."""

from typing import Any

from pydantic import BaseModel


class ScenariosGenerationCompleteEvent(BaseModel):
    """Server-to-client event: scenarios_generation_complete."""

    artifact_type: str
    resource_type: str = "scenarios"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
