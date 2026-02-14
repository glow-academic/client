"""Typed event models for texts resource generation."""

from typing import Any

from pydantic import BaseModel


class TextsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: texts_generation_complete."""

    artifact_type: str
    resource_type: str = "texts"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
