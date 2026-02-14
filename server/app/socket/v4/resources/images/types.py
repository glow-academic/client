"""Typed event models for images resource generation."""

from typing import Any

from pydantic import BaseModel


class ImagesGenerationCompleteEvent(BaseModel):
    """Server-to-client event: images_generation_complete."""

    artifact_type: str
    resource_type: str = "images"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
