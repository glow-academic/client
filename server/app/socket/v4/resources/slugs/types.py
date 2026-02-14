"""Typed event models for slugs resource generation."""

from typing import Any

from pydantic import BaseModel


class SlugsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: slugs_generation_complete."""

    artifact_type: str
    resource_type: str = "slugs"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
