"""Typed event models for modalities resource generation."""

from typing import Any

from pydantic import BaseModel


class ModalitiesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: modalities_generation_complete."""

    artifact_type: str
    resource_type: str = "modalities"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
