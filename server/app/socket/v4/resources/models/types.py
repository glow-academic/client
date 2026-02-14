"""Typed event models for models resource generation."""

from typing import Any

from pydantic import BaseModel


class ModelsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: models_generation_complete."""

    artifact_type: str
    resource_type: str = "models"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
