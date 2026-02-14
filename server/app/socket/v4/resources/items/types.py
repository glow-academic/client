"""Typed event models for items resource generation."""

from typing import Any

from pydantic import BaseModel


class ItemsGenerationCompleteEvent(BaseModel):
    """Server-to-client event: items_generation_complete."""

    artifact_type: str
    resource_type: str = "items"
    resource_id: str | None = None
    group_id: str
    run_id: str | None = None
    success: bool = True
    data: dict[str, Any] | None = None
