"""Typed event models for thresholds resource generation."""

from typing import Any

from pydantic import BaseModel


class ThresholdsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: thresholds_generation_complete."""

    artifact_type: str
    resource_type: str = "thresholds"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
