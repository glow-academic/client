"""Typed event models for points resource generation."""

from typing import Any

from pydantic import BaseModel


class PointsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: points_generation_complete."""

    artifact_type: str
    resource_type: str = "points"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
