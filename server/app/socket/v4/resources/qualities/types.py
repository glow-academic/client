"""Typed event models for qualities resource generation."""

from typing import Any

from pydantic import BaseModel


class QualitiesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: qualities_generation_complete."""

    artifact_type: str
    resource_type: str = "qualities"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
